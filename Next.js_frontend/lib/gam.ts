import crypto from 'node:crypto'

/**
 * GAM (Google Ad Manager) MCM client.
 *
 * Ported from the MA Dashboard's lib/gam-soap.ts. Service-account JWT flow —
 * no OAuth redirect, no user consent. Requires GAM_CLIENT_EMAIL and
 * GAM_PRIVATE_KEY; both are server-only and must never reach the client bundle.
 *
 * The parent (publisher) network is hardcoded because it is the account we
 * create children under.
 */

const GAM_VERSION = 'v202602'
const GAM_NETWORK_CODE = '22862221459'
const DFP_SCOPE = 'https://www.googleapis.com/auth/dfp'

/** Normalise a key that may arrive with escaped newlines or stray quotes. */
function sanitizeKey(raw: string): string {
  let key = raw.trim()
  key = key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
  key = key.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  key = key.replace(/^"|"$/g, '').trim()
  if (!key.endsWith('\n')) key += '\n'
  return key
}

function getCredentials(): { clientEmail: string; privateKey: string } {
  const clientEmail = process.env.GAM_CLIENT_EMAIL
  const privateKey = process.env.GAM_PRIVATE_KEY
  if (!clientEmail || !privateKey) {
    throw new Error('GAM credentials not configured (GAM_CLIENT_EMAIL / GAM_PRIVATE_KEY)')
  }
  return { clientEmail, privateKey: sanitizeKey(privateKey) }
}

let cachedToken: string | null = null
let tokenExpiry = 0

const b64url = (data: string) => Buffer.from(data).toString('base64url')

function makeJwtAssertion(clientEmail: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)
  const message = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify({
      iss: clientEmail,
      sub: clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      scope: DFP_SCOPE,
      iat: now,
      exp: now + 3600,
    }),
  )}`

  let keyObject: crypto.KeyObject
  try {
    keyObject = crypto.createPrivateKey(privateKey)
  } catch {
    const pkcs1 = privateKey
      .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----')
      .replace('-----END PRIVATE KEY-----', '-----END RSA PRIVATE KEY-----')
    try {
      keyObject = crypto.createPrivateKey(pkcs1)
    } catch {
      throw new Error('Failed to parse GAM_PRIVATE_KEY — expected a PKCS#8 RSA private key.')
    }
  }

  return `${message}.${crypto.sign(null, Buffer.from(message), keyObject).toString('base64url')}`
}

/** Cached for 50 minutes; the assertion itself is valid for 60. */
export async function getGAMToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const { clientEmail, privateKey } = getCredentials()
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: makeJwtAssertion(clientEmail, privateKey),
    }),
  })

  if (!resp.ok) {
    throw new Error(`GAM token exchange failed (${resp.status}): ${(await resp.text()).slice(0, 300)}`)
  }

  const { access_token } = (await resp.json()) as { access_token?: string }
  if (!access_token) throw new Error('GAM token exchange returned no access_token')

  cachedToken = access_token
  tokenExpiry = Date.now() + 50 * 60 * 1000
  return access_token
}

/**
 * Escape a value before it goes into the SOAP body.
 *
 * displayName and email are partner-supplied. Without this, a value like
 * `a&b</name><type>PREMIUM</type>` would rewrite the request Google receives —
 * XML injection into a privileged API call.
 */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Header>
    <ns1:RequestHeader xmlns:ns1="https://www.google.com/apis/ads/publisher/${GAM_VERSION}">
      <ns1:networkCode>${GAM_NETWORK_CODE}</ns1:networkCode>
      <ns1:applicationName>AdGlobeX Partner Portal</ns1:applicationName>
    </ns1:RequestHeader>
  </soapenv:Header>
  <soapenv:Body>${body}</soapenv:Body>
</soapenv:Envelope>`
}

async function soapCall(service: string, body: string): Promise<string> {
  const token = await getGAMToken()
  const resp = await fetch(`https://ads.google.com/apis/ads/publisher/${GAM_VERSION}/${service}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      SOAPAction: '""',
      Authorization: `Bearer ${token}`,
    },
    body: buildEnvelope(body),
  })

  const text = await resp.text()
  if (!resp.ok) throw new Error(`GAM ${service} HTTP ${resp.status}: ${text.slice(0, 500)}`)
  // GAM reports SOAP faults with HTTP 200, so the status alone is not enough.
  if (/<soapenv:Fault|<Fault>/i.test(text)) {
    throw new Error(`GAM ${service} fault: ${text.slice(0, 500)}`)
  }
  return text
}

/** Flatten every `<name>value</name>` pair inside each `<rval>` block. */
function extractRvalBlocks(xml: string): Record<string, string>[] {
  const cleaned = xml.replace(/\s+xmlns[^=]*="[^"]*"/g, '')
  const blocks: Record<string, string>[] = []
  for (const match of cleaned.matchAll(/<rval>([\s\S]*?)<\/rval>/g)) {
    const fields: Record<string, string> = {}
    for (const field of match[1].matchAll(/<(\w+)>([^<]*)<\/\1>/g)) {
      fields[field[1]] = field[2].trim()
    }
    if (Object.keys(fields).length > 0) blocks.push(fields)
  }
  return blocks
}

export interface CreateChildResult {
  companyId: string
  invitationStatus: string
}

export async function createMCMChild(params: {
  childNetworkCode: string
  email: string
  displayName: string
  proposedDelegationType: 'MANAGE_ACCOUNT' | 'MANAGE_INVENTORY'
  proposedRevenueShareMillipercent: number
}): Promise<CreateChildResult> {
  const body = `<createCompanies xmlns="https://www.google.com/apis/ads/publisher/${GAM_VERSION}">
    <companies>
      <name>${xmlEscape(params.displayName)}</name>
      <type>CHILD_PUBLISHER</type>
      <email>${xmlEscape(params.email)}</email>
      <childPublisher>
        <proposedDelegationType>${params.proposedDelegationType}</proposedDelegationType>
        <childNetworkCode>${xmlEscape(params.childNetworkCode)}</childNetworkCode>
        <proposedRevenueShareMillipercent>${params.proposedRevenueShareMillipercent}</proposedRevenueShareMillipercent>
      </childPublisher>
    </companies>
  </createCompanies>`

  const blocks = extractRvalBlocks(await soapCall('CompanyService', body))
  if (blocks.length === 0) throw new Error('GAM returned no company in the createCompanies response')

  return {
    companyId: blocks[0].id ?? '',
    invitationStatus: blocks[0].invitationStatus ?? '',
  }
}
