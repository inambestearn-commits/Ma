import type { Partner, PartnerUser } from './types'

export const partners: Partner[] = [
  {
    id: 'ptn_4821', partner_ticket: 'AGX-1001', name: 'Northstar Publishing', type: 'Media partner',
    contact_name: 'Dana Reyes', contact_email: 'ops@northstarpublishing.com', revenue_share: 10,
    status: 'ACTIVE', sites: 248, active_sites: 214, revenue: 28420, mcm: 'GAM Primary (MCM-001)',
    created_at: '2025-11-04', updated_at: '2026-10-01', last_login: '2026-10-05T08:12:00Z',
    notes: 'Flagship media partner. Revenue share configured as 10 parent / 90 child (BR-006).',
  },
  {
    id: 'ptn_4822', partner_ticket: 'AGX-1002', name: 'Atlas Digital Group', type: 'Agency',
    contact_name: 'Priya Nair', contact_email: 'finance@atlasdigital.co', revenue_share: 12,
    status: 'ACTIVE', sites: 184, active_sites: 161, revenue: 19860, mcm: 'GAM Primary (MCM-001)',
    created_at: '2025-12-18', updated_at: '2026-09-27', last_login: '2026-10-04T16:40:00Z',
    notes: 'Agency reseller. Requires monthly statement approval before release.',
  },
  {
    id: 'ptn_4823', partner_ticket: 'AGX-1003', name: 'Bloom Commerce', type: 'Advertiser',
    contact_name: 'Marco Silva', contact_email: 'hello@bloomcommerce.io', revenue_share: 15,
    status: 'SUSPENDED', sites: 36, active_sites: 12, revenue: 4280, mcm: 'GAM Primary (MCM-001)',
    created_at: '2026-02-11', updated_at: '2026-09-30', last_login: '2026-09-19T11:05:00Z',
    notes: 'Pending onboarding review after two policy warnings.',
  },
  {
    id: 'ptn_4824', partner_ticket: 'AGX-1004', name: 'Signal House', type: 'Media partner',
    contact_name: 'Elise Moreau', contact_email: 'team@signalhouse.media', revenue_share: 10,
    status: 'ACTIVE', sites: 92, active_sites: 74, revenue: 12640, mcm: 'GAM Primary (MCM-001)',
    created_at: '2026-01-22', updated_at: '2026-10-02', last_login: '2026-10-05T07:55:00Z',
    notes: 'Fastest growing partner this quarter (+21% MoM).',
  },
  {
    id: 'ptn_4825', partner_ticket: 'AGX-1005', name: 'Coastal Wire', type: 'Publisher',
    contact_name: 'Owen Hartley', contact_email: 'admin@coastalwire.news', revenue_share: 8,
    status: 'DISABLED', sites: 61, active_sites: 19, revenue: 8910, mcm: 'GAM Primary (MCM-001)',
    created_at: '2025-10-09', updated_at: '2026-08-30', last_login: '2026-08-14T13:22:00Z',
    notes: 'Access disabled after IVT critical alert on 3 properties.',
  },
  {
    id: 'ptn_4826', partner_ticket: 'AGX-1006', name: 'Vertex Media Labs', type: 'Agency',
    contact_name: 'Sara Kim', contact_email: 'ops@vertexmedialabs.com', revenue_share: 12,
    status: 'ACTIVE', sites: 47, active_sites: 44, revenue: 7120, mcm: 'GAM Primary (MCM-001)',
    created_at: '2026-04-02', updated_at: '2026-09-21', last_login: '2026-10-03T09:31:00Z',
    notes: '',
  },
  {
    id: 'ptn_4827', partner_ticket: 'AGX-1007', name: 'Harborline News', type: 'Media partner',
    contact_name: 'Tomas Berg', contact_email: 'biz@harborline.news', revenue_share: 10,
    status: 'ACTIVE', sites: 33, active_sites: 30, revenue: 5480, mcm: 'GAM Primary (MCM-001)',
    created_at: '2026-05-19', updated_at: '2026-09-29', last_login: '2026-10-01T18:02:00Z',
    notes: '',
  },
  {
    id: 'ptn_4828', partner_ticket: 'AGX-1008', name: 'Lumen Apps', type: 'Publisher',
    contact_name: 'Grace Oduya', contact_email: 'dev@lumenapps.io', revenue_share: 9,
    status: 'CLOSED', sites: 14, active_sites: 0, revenue: 960, mcm: 'GAM Primary (MCM-001)',
    created_at: '2025-09-15', updated_at: '2026-06-12', last_login: '2026-05-30T10:10:00Z',
    notes: 'Relationship closed by mutual agreement.',
  },
]

export const partnerUsers: PartnerUser[] = [
  { id: 'usr_01', partner_ticket: 'AGX-1001', full_name: 'Dana Reyes', email: 'ops@northstarpublishing.com', role: 'Partner Admin', status: 'Active', last_login: '2026-10-05T08:12:00Z', created_at: '2025-11-04' },
  { id: 'usr_02', partner_ticket: 'AGX-1001', full_name: 'Ken Ito', email: 'ken@northstarpublishing.com', role: 'Partner User', status: 'Active', last_login: '2026-10-04T22:47:00Z', created_at: '2025-11-06' },
  { id: 'usr_03', partner_ticket: 'AGX-1001', full_name: 'Ruth Alvarez', email: 'reporting@northstarpublishing.com', role: 'Partner Read Only', status: 'Active', last_login: '2026-09-28T14:03:00Z', created_at: '2026-01-15' },
  { id: 'usr_04', partner_ticket: 'AGX-1002', full_name: 'Priya Nair', email: 'finance@atlasdigital.co', role: 'Partner Admin', status: 'Active', last_login: '2026-10-04T16:40:00Z', created_at: '2025-12-18' },
  { id: 'usr_05', partner_ticket: 'AGX-1002', full_name: 'Leo Fischer', email: 'leo@atlasdigital.co', role: 'Partner User', status: 'Invited', last_login: null, created_at: '2026-09-30' },
  { id: 'usr_06', partner_ticket: 'AGX-1003', full_name: 'Marco Silva', email: 'hello@bloomcommerce.io', role: 'Partner Admin', status: 'Disabled', last_login: '2026-09-19T11:05:00Z', created_at: '2026-02-11' },
  { id: 'usr_07', partner_ticket: 'AGX-1004', full_name: 'Elise Moreau', email: 'team@signalhouse.media', role: 'Partner Admin', status: 'Active', last_login: '2026-10-05T07:55:00Z', created_at: '2026-01-22' },
  { id: 'usr_08', partner_ticket: 'AGX-1005', full_name: 'Owen Hartley', email: 'admin@coastalwire.news', role: 'Partner Admin', status: 'Disabled', last_login: '2026-08-14T13:22:00Z', created_at: '2025-10-09' },
  { id: 'usr_09', partner_ticket: '—', full_name: 'Alex Morgan', email: 'alex@adglobex.media', role: 'Super Admin', status: 'Active', last_login: '2026-10-05T09:04:00Z', created_at: '2025-08-01' },
  { id: 'usr_10', partner_ticket: '—', full_name: 'Nadia Haddad', email: 'nadia@adglobex.media', role: 'Operations', status: 'Active', last_login: '2026-10-05T08:44:00Z', created_at: '2025-08-12' },
  { id: 'usr_11', partner_ticket: '—', full_name: 'Ben Cole', email: 'ben@adglobex.media', role: 'Finance', status: 'Active', last_login: '2026-10-04T17:20:00Z', created_at: '2025-09-03' },
  { id: 'usr_12', partner_ticket: '—', full_name: 'Ivy Chen', email: 'ivy@adglobex.media', role: 'Support', status: 'Active', last_login: '2026-10-05T06:58:00Z', created_at: '2025-10-21' },
]

/** The signed-in profile shown in the sidebar for each portal. */
export const profiles = {
  admin: { full_name: 'Alex Morgan', email: 'alex@adglobex.media', role: 'Super Admin', initials: 'AM', partner_ticket: null as string | null },
  partner: { full_name: 'Dana Reyes', email: 'ops@northstarpublishing.com', role: 'Partner Admin', initials: 'DR', partner_ticket: 'AGX-1001' },
}
