import type { PublisherSite } from './types'

const p = (
  id: string, n: number, site: string, partner_ticket: string, partner_name: string,
  status: PublisherSite['status'], api_status: PublisherSite['api_status'],
  delegation: 'MA' | 'MI', ads_txt: PublisherSite['ads_txt'], email: string,
  network_code: string, revenue_share: number, last_invite: string | null,
  onboarding: string, updated: string, mcm = 'MCM-001',
): PublisherSite => ({
  id: `site_${n}`,
  publisher_ticket: `${partner_ticket}-${String(n).padStart(6, '0')}`,
  site,
  canonical_site: `https://${site}`,
  partner_ticket,
  partner_name,
  status,
  api_status,
  delegation,
  ads_txt,
  publisher_email: email,
  network_code,
  revenue_share,
  mcm,
  last_invite,
  onboarding_date: onboarding,
  updated_at: updated,
})

export const publisherSites: PublisherSite[] = [
  p('a', 1, 'northstarpublishing.com', 'AGX-1001', 'Northstar Publishing', 'ACTIVE', 'OK', 'MA', 'Verified', 'publisher@gmail.com', '12345678', 10, '2026-09-28', '2025-11-08', '2026-10-04'),
  p('b', 2, 'northstar-daily.net', 'AGX-1001', 'Northstar Publishing', 'ACTIVE', 'OK', 'MA', 'Verified', 'publisher@gmail.com', '12345679', 10, '2026-08-14', '2025-11-20', '2026-10-03'),
  p('c', 3, 'northstar-games.io', 'AGX-1001', 'Northstar Publishing', 'INVITED', 'NOT_INVITED', 'MI', 'Unverified', 'ops@northstarpublishing.com', '12345681', 10, '2026-10-02', '2026-10-02', '2026-10-02'),
  p('d', 4, 'northstar-weekly.com', 'AGX-1001', 'Northstar Publishing', 'PENDING', 'SYNCING', 'MA', 'Unverified', 'ops@northstarpublishing.com', '12345682', 10, '2026-09-30', '2026-09-29', '2026-10-01'),
  p('e', 5, 'northstar-video.tv', 'AGX-1001', 'Northstar Publishing', 'EXPIRED', 'API_ERROR', 'MI', 'Blocked', 'publisher@gmail.com', '12345683', 10, '2026-07-11', '2026-06-11', '2026-08-01'),
  p('f', 6, 'atlasdaily.co', 'AGX-1002', 'Atlas Digital Group', 'PENDING', 'SYNCING', 'MI', 'Unverified', 'publisher@gmail.com', '22001100', 12, '2026-10-03', '2026-10-01', '2026-10-03'),
  p('g', 7, 'atlasbiz.com', 'AGX-1002', 'Atlas Digital Group', 'ACTIVE', 'OK', 'MA', 'Verified', 'publisher@gmail.com', '22001101', 12, '2026-06-19', '2025-12-22', '2026-10-02'),
  p('h', 8, 'atlasmarkets.io', 'AGX-1002', 'Atlas Digital Group', 'ACTIVE', 'OK', 'MA', 'Verified', 'publisher@gmail.com', '22001102', 12, '2026-05-30', '2026-01-09', '2026-09-30'),
  p('i', 9, 'atlasweekend.co', 'AGX-1002', 'Atlas Digital Group', 'WITHDRAWN', 'NOT_INVITED', 'MI', 'Missing line', 'publisher@gmail.com', '22001103', 12, '2026-04-04', '2026-03-15', '2026-07-18'),
  p('j', 10, 'bloomcommerce.io', 'AGX-1003', 'Bloom Commerce', 'ACCEPTED', 'OK', 'MA', 'Verified', 'publisher@gmail.com', '33002200', 15, '2026-09-21', '2026-02-14', '2026-09-28'),
  p('k', 11, 'bloomdeals.shop', 'AGX-1003', 'Bloom Commerce', 'DECLINED', 'NOT_INVITED', 'MI', 'Unverified', 'publisher@gmail.com', '33002201', 15, '2026-05-02', '2026-04-28', '2026-05-06'),
  p('l', 12, 'signalhouse.media', 'AGX-1004', 'Signal House', 'WITHDRAWN', 'API_ERROR', 'MI', 'Missing line', 'publisher@gmail.com', '44003300', 10, '2026-08-15', '2026-01-30', '2026-09-12'),
  p('m', 13, 'signalwire.tv', 'AGX-1004', 'Signal House', 'ACTIVE', 'OK', 'MA', 'Verified', 'publisher@gmail.com', '44003301', 10, '2026-07-07', '2026-02-03', '2026-10-04'),
  p('n', 14, 'signalplay.app', 'AGX-1004', 'Signal House', 'CLOSED', 'NOT_INVITED', 'MA', 'Blocked', 'publisher@gmail.com', '44003302', 10, '2026-03-19', '2025-12-01', '2026-04-02'),
  p('o', 15, 'coastalwire.news', 'AGX-1005', 'Coastal Wire', 'EXPIRED', 'API_ERROR', 'MA', 'Blocked', 'publisher@gmail.com', '55004400', 8, '2026-07-29', '2025-10-15', '2026-08-30'),
  p('q', 16, 'coastalreport.com', 'AGX-1005', 'Coastal Wire', 'WITHDRAWN', 'NOT_INVITED', 'MI', 'Missing line', 'publisher@gmail.com', '55004401', 8, '2026-06-08', '2025-11-11', '2026-06-22'),
  p('r', 17, 'coastalbreak.com', 'AGX-1005', 'Coastal Wire', 'PENDING', 'SYNCING', 'MA', 'Unverified', 'publisher@gmail.com', '55004402', 8, '2026-10-01', '2026-09-30', '2026-10-01'),
  p('s', 18, 'vertexlabs.io', 'AGX-1006', 'Vertex Media Labs', 'ACTIVE', 'OK', 'MA', 'Verified', 'publisher@gmail.com', '66005500', 12, '2026-04-11', '2026-04-05', '2026-10-03'),
  p('t', 19, 'vertexdaily.com', 'AGX-1006', 'Vertex Media Labs', 'INVITED', 'NOT_INVITED', 'MI', 'Unverified', 'publisher@gmail.com', '66005501', 12, '2026-10-04', '2026-10-04', '2026-10-04'),
  p('u', 20, 'harborline.news', 'AGX-1007', 'Harborline News', 'ACTIVE', 'OK', 'MA', 'Verified', 'publisher@gmail.com', '77006600', 10, '2026-05-25', '2026-05-20', '2026-10-02'),
  p('v', 21, 'harborpost.com', 'AGX-1007', 'Harborline News', 'ACTIVE', 'SYNCING', 'MA', 'Verified', 'publisher@gmail.com', '77006601', 10, '2026-06-30', '2026-06-24', '2026-10-05'),
  p('w', 22, 'lumenapps.io', 'AGX-1008', 'Lumen Apps', 'CLOSED', 'NOT_INVITED', 'MA', 'Blocked', 'publisher@gmail.com', '88007700', 9, '2026-02-16', '2025-09-20', '2026-06-12'),
  p('x', 23, 'lumenplay.net', 'AGX-1008', 'Lumen Apps', 'DRAFT', 'NOT_INVITED', 'MI', 'Unverified', 'publisher@gmail.com', '88007701', 9, null, '2026-06-01', '2026-06-01'),
]

/** Status tab counts for the Overall Sites / Manage Publishers screens. */
export const lifecycleTabs = ['All', 'Active', 'Pending', 'Invited', 'Withdrawn', 'Declined', 'Closed', 'Expired'] as const
