import type { CsvImport, Payment, RevenueRecord, Statement } from './types'

export const revenueRecords: RevenueRecord[] = [
  { id: 'rv_01', date: '2026-10-04', partner_ticket: 'AGX-1001', partner_name: 'Northstar Publishing', site: 'northstarpublishing.com', impressions: 4820113, clicks: 141204, gross: 4318.42, adjustments: -62.1, net: 4256.32, partner_share: 3830.69, adglobe_share: 425.63, state: 'validated' },
  { id: 'rv_02', date: '2026-10-04', partner_ticket: 'AGX-1001', partner_name: 'Northstar Publishing', site: 'northstar-daily.net', impressions: 3114880, clicks: 88312, gross: 2740.05, adjustments: -18.4, net: 2721.65, partner_share: 2449.49, adglobe_share: 272.16, state: 'validated' },
  { id: 'rv_03', date: '2026-10-04', partner_ticket: 'AGX-1002', partner_name: 'Atlas Digital Group', site: 'atlasdaily.co', impressions: 2650422, clicks: 71908, gross: 2298.77, adjustments: -44.0, net: 2254.77, partner_share: 1984.2, adglobe_share: 270.57, state: 'validated' },
  { id: 'rv_04', date: '2026-10-04', partner_ticket: 'AGX-1004', partner_name: 'Signal House', site: 'signalwire.tv', impressions: 1904772, clicks: 52144, gross: 1712.3, adjustments: 0, net: 1712.3, partner_share: 1541.07, adglobe_share: 171.23, state: 'provisional' },
  { id: 'rv_05', date: '2026-10-03', partner_ticket: 'AGX-1006', partner_name: 'Vertex Media Labs', site: 'vertexlabs.io', impressions: 1502118, clicks: 41880, gross: 1310.44, adjustments: -12.0, net: 1298.44, partner_share: 1142.63, adglobe_share: 155.81, state: 'validated' },
  { id: 'rv_06', date: '2026-10-03', partner_ticket: 'AGX-1007', partner_name: 'Harborline News', site: 'harborline.news', impressions: 1288440, clicks: 35019, gross: 1140.92, adjustments: -8.7, net: 1132.22, partner_share: 1019.0, adglobe_share: 113.22, state: 'reconciled' },
  { id: 'rv_07', date: '2026-10-03', partner_ticket: 'AGX-1003', partner_name: 'Bloom Commerce', site: 'bloomcommerce.io', impressions: 902331, clicks: 24117, gross: 741.18, adjustments: -96.5, net: 644.68, partner_share: 547.98, adglobe_share: 96.7, state: 'adjusted' },
  { id: 'rv_08', date: '2026-10-02', partner_ticket: 'AGX-1005', partner_name: 'Coastal Wire', site: 'coastalwire.news', impressions: 640012, clicks: 12884, gross: 402.55, adjustments: -301.91, net: 100.64, partner_share: 92.59, adglobe_share: 8.05, state: 'adjusted' },
  { id: 'rv_09', date: '2026-10-02', partner_ticket: 'AGX-1002', partner_name: 'Atlas Digital Group', site: 'atlasbiz.com', impressions: 2114003, clicks: 58331, gross: 1922.6, adjustments: 0, net: 1922.6, partner_share: 1691.89, adglobe_share: 230.71, state: 'reconciled' },
  { id: 'rv_10', date: '2026-10-02', partner_ticket: 'AGX-1001', partner_name: 'Northstar Publishing', site: 'northstar-games.io', impressions: 774220, clicks: 26008, gross: 816.9, adjustments: -4.2, net: 812.7, partner_share: 731.43, adglobe_share: 81.27, state: 'finalized' },
  { id: 'rv_11', date: '2026-10-01', partner_ticket: 'AGX-1004', partner_name: 'Signal House', site: 'signalplay.app', impressions: 1122004, clicks: 30552, gross: 996.11, adjustments: 0, net: 996.11, partner_share: 896.5, adglobe_share: 99.61, state: 'finalized' },
  { id: 'rv_12', date: '2026-10-01', partner_ticket: 'AGX-1008', partner_name: 'Lumen Apps', site: 'lumenplay.net', impressions: 41220, clicks: 611, gross: 12.4, adjustments: 0, net: 12.4, partner_share: 11.28, adglobe_share: 1.12, state: 'provisional' },
]

export const statements: Statement[] = [
  { id: 'ST-2026-092', partner_ticket: 'AGX-1001', partner_name: 'Northstar Publishing', period: 'Sep 2026', period_start: '2026-09-01', period_end: '2026-09-30', gross: 28420, adjustments: -318.4, net_payable: 25259.6, status: 'Approved', due_date: 'Oct 10' },
  { id: 'ST-2026-091', partner_ticket: 'AGX-1002', partner_name: 'Atlas Digital Group', period: 'Sep 2026', period_start: '2026-09-01', period_end: '2026-09-30', gross: 19860, adjustments: -141.2, net_payable: 17335.68, status: 'Processing', due_date: 'Oct 10' },
  { id: 'ST-2026-090', partner_ticket: 'AGX-1004', partner_name: 'Signal House', period: 'Sep 2026', period_start: '2026-09-01', period_end: '2026-09-30', gross: 12640, adjustments: 0, net_payable: 11376.0, status: 'Paid', due_date: 'Oct 05' },
  { id: 'ST-2026-089', partner_ticket: 'AGX-1005', partner_name: 'Coastal Wire', period: 'Sep 2026', period_start: '2026-09-01', period_end: '2026-09-30', gross: 8910, adjustments: -6240.1, net_payable: 2350.71, status: 'On hold', due_date: 'Review' },
  { id: 'ST-2026-088', partner_ticket: 'AGX-1006', partner_name: 'Vertex Media Labs', period: 'Sep 2026', period_start: '2026-09-01', period_end: '2026-09-30', gross: 7120, adjustments: -32.5, net_payable: 6220.4, status: 'Pending approval', due_date: 'Oct 15' },
  { id: 'ST-2026-087', partner_ticket: 'AGX-1007', partner_name: 'Harborline News', period: 'Sep 2026', period_start: '2026-09-01', period_end: '2026-09-30', gross: 5480, adjustments: 0, net_payable: 4932.0, status: 'Approved', due_date: 'Oct 10' },
  { id: 'ST-2026-086', partner_ticket: 'AGX-1003', partner_name: 'Bloom Commerce', period: 'Sep 2026', period_start: '2026-09-01', period_end: '2026-09-30', gross: 4280, adjustments: -1240.9, net_payable: 2585.81, status: 'Draft', due_date: '—' },
  { id: 'ST-2026-085', partner_ticket: 'AGX-1001', partner_name: 'Northstar Publishing', period: 'Aug 2026', period_start: '2026-08-01', period_end: '2026-08-31', gross: 26110, adjustments: -190.0, net_payable: 23309.0, status: 'Paid', due_date: 'Sep 10' },
]

export const payments: Payment[] = [
  { id: 'pay_01', partner_ticket: 'AGX-1004', partner_name: 'Signal House', amount: 11376.0, currency: 'USD', period_start: '2026-09-01', period_end: '2026-09-30', status: 'Released', released_date: '2026-10-05', reference: 'PMT-2026-1005-01', statement_ref: 'ST-2026-090', adjustments: 0 },
  { id: 'pay_02', partner_ticket: 'AGX-1002', partner_name: 'Atlas Digital Group', amount: 17335.68, currency: 'USD', period_start: '2026-09-01', period_end: '2026-09-30', status: 'Processing', released_date: null, reference: 'PMT-2026-1004-03', statement_ref: 'ST-2026-091', adjustments: -141.2 },
  { id: 'pay_03', partner_ticket: 'AGX-1001', partner_name: 'Northstar Publishing', amount: 25259.6, currency: 'USD', period_start: '2026-09-01', period_end: '2026-09-30', status: 'Pending', released_date: null, reference: 'PMT-2026-1005-04', statement_ref: 'ST-2026-092', adjustments: -318.4 },
  { id: 'pay_04', partner_ticket: 'AGX-1007', partner_name: 'Harborline News', amount: 4932.0, currency: 'USD', period_start: '2026-09-01', period_end: '2026-09-30', status: 'Pending', released_date: null, reference: 'PMT-2026-1005-05', statement_ref: 'ST-2026-087', adjustments: 0 },
  { id: 'pay_05', partner_ticket: 'AGX-1005', partner_name: 'Coastal Wire', amount: 2350.71, currency: 'USD', period_start: '2026-09-01', period_end: '2026-09-30', status: 'On hold', released_date: null, reference: '—', statement_ref: 'ST-2026-089', adjustments: -6240.1 },
  { id: 'pay_06', partner_ticket: 'AGX-1006', partner_name: 'Vertex Media Labs', amount: 6220.4, currency: 'USD', period_start: '2026-09-01', period_end: '2026-09-30', status: 'Pending', released_date: null, reference: '—', statement_ref: 'ST-2026-088', adjustments: -32.5 },
  { id: 'pay_07', partner_ticket: 'AGX-1001', partner_name: 'Northstar Publishing', amount: 23309.0, currency: 'USD', period_start: '2026-08-01', period_end: '2026-08-31', status: 'Released', released_date: '2026-09-10', reference: 'PMT-2026-0910-02', statement_ref: 'ST-2026-085', adjustments: -190.0 },
  { id: 'pay_08', partner_ticket: 'AGX-1002', partner_name: 'Atlas Digital Group', amount: 16804.12, currency: 'USD', period_start: '2026-08-01', period_end: '2026-08-31', status: 'Released', released_date: '2026-09-10', reference: 'PMT-2026-0910-07', statement_ref: 'ST-2026-084', adjustments: -98.4 },
]

export const csvImports: CsvImport[] = [
  { id: 'csv_09', month: 'September', year: 2026, uploaded_at: '2026-10-02T09:14:00Z', uploader: 'ben@adglobex.media', file_hash: 'a91f3c7d', rows: 184220, errors: 0, status: 'Imported' },
  { id: 'csv_08', month: 'August', year: 2026, uploaded_at: '2026-09-03T10:02:00Z', uploader: 'ben@adglobex.media', file_hash: '77b2e104', rows: 176841, errors: 12, status: 'Imported' },
  { id: 'csv_07', month: 'July', year: 2026, uploaded_at: '2026-08-04T08:47:00Z', uploader: 'ben@adglobex.media', file_hash: 'c4d908ab', rows: 168009, errors: 0, status: 'Imported' },
  { id: 'csv_06', month: 'June', year: 2026, uploaded_at: '2026-07-02T11:33:00Z', uploader: 'nadia@adglobex.media', file_hash: '1e5f77c2', rows: 159442, errors: 3, status: 'Imported' },
  { id: 'csv_10', month: 'October', year: 2026, uploaded_at: '2026-10-05T07:20:00Z', uploader: 'ben@adglobex.media', file_hash: 'pending', rows: 0, errors: 0, status: 'Validating' },
]
