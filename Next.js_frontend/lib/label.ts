/**
 * Sanitizing BigQuery `network_codes.label` values for display.
 *
 * A label is now `<TAG>-<domain>` — e.g. `pt-24-yasobe.com`, the tag leads
 * (see TAG_PREFIX_EXPR in lib/bq.ts). Legacy rows still in the source data use
 * `<domain>/<TAG>` and are dirty in several distinct ways, all of which occur
 * in production rows:
 *
 *   whitespace before the slash   `healthfresco.com\t/pt-23`
 *   scheme prefix                 `https://Nestbridal.com/PT-23`
 *   junk prefix                   `URL: https:/pt-23`
 *   tag with no domain at all     `PT-24`
 *   bare pseudo-domain            `App/PT-24`
 *
 * The partner tag itself is never recovered here (prefix match in lib/bq.ts,
 * slash split for legacy rows in lib/submissions.ts) — this module only
 * handles the cosmetic half: producing a readable site name.
 */

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i
const SCHEME_ONLY_RE = /^[a-z][a-z0-9+.-]*:$/i

/**
 * Returns the site half of a label, cleaned for display.
 *
 * When the caller passes the session `tag` (every partner-scoped route does),
 * a leading `<TAG>-` is stripped first, so `pt-24-yasobe.com` shows as
 * `yasobe.com`. Without the tag — the admin's view — a new-format label is
 * returned whole, tag included, which is what an admin wants to see.
 *
 * Prefers a parseable domain. When the prefix is not a domain but still carries
 * readable text (`App/PT-24`), that text is returned so the partner recognises
 * their own entry. Returns '(unlabeled)' only when nothing usable precedes the
 * tag, as in `https:/pt-23`.
 */
export function displayDomain(label: string, tag?: string): string {
  let value = label
  if (tag) {
    const prefix = `${tag.trim().toLowerCase()}-`
    if (value.toLowerCase().startsWith(prefix)) value = value.slice(prefix.length)
  }
  const lastSlash = value.lastIndexOf('/')
  let prefix = lastSlash === -1 ? value : value.slice(0, lastSlash)

  // Strip scheme fragments repeatedly — labels like `URL: https:/pt-23` carry
  // more than one, and a lone `https:` is never a site name.
  for (let i = 0; i < 3; i++) {
    const next = prefix
      .replace(/^[a-z][a-z0-9+.-]*:\/?\/?/i, '')
      .replace(/^[^a-z0-9]+/i, '')
      .trim()
    if (next === prefix || !next) break
    prefix = next
  }

  if (!prefix || SCHEME_ONLY_RE.test(prefix)) return '(unlabeled)'

  // Take the last whitespace-separated token, in case of `Mezu.site /pt-23`.
  const candidate = prefix.split(/\s+/).pop() ?? ''
  if (!candidate || SCHEME_ONLY_RE.test(candidate)) return '(unlabeled)'

  return DOMAIN_RE.test(candidate) ? candidate : prefix
}

/** True when the label carried a usable domain rather than falling back. */
export function hasDisplayableDomain(label: string): boolean {
  return displayDomain(label) !== '(unlabeled)'
}
