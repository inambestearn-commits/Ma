import type { McmConnection, McmRelationship } from './types'

export const mcmConnections: McmConnection[] = [
  {
    mcm_id: 'MCM-001', mcm_name: 'GAM Primary', provider_type: 'google_ad_manager',
    account_reference: 'pub-482001', status: 'Active', default_flag: true, priority: 1,
    capabilities: ['invite_site', 'resend_invite', 'withdraw_site', 'status_sync', 'fetch_report', 'fetch_adjustments'],
    last_success_sync: '2026-10-05T09:12:00Z', last_attempted_sync: '2026-10-05T09:12:00Z',
    last_error: null, relationships: 23, health: 'Healthy',
  },
  {
    mcm_id: 'MCM-002', mcm_name: 'GAM Secondary (staging)', provider_type: 'google_ad_manager',
    account_reference: 'pub-482002', status: 'Maintenance', default_flag: false, priority: 2,
    capabilities: ['status_sync', 'fetch_report'],
    last_success_sync: '2026-09-28T14:00:00Z', last_attempted_sync: '2026-10-04T18:41:00Z',
    last_error: 'Adapter not yet enabled — configuration only (multi-MCM ready, §32).', relationships: 0, health: 'Degraded',
  },
]

export const mcmRelationships: McmRelationship[] = [
  { id: 'rel_01', site: 'northstarpublishing.com', partner_ticket: 'AGX-1001', mcm_id: 'MCM-001', network_code: '12345678', invite_state: 'Accepted', api_status: 'OK', last_sync: '2026-10-05T09:12:00Z', status_history: [{ at: '2025-11-08T10:00:00Z', from: 'Not sent', to: 'Sent' }, { at: '2025-11-09T08:22:00Z', from: 'Sent', to: 'Accepted' }] },
  { id: 'rel_02', site: 'northstar-daily.net', partner_ticket: 'AGX-1001', mcm_id: 'MCM-001', network_code: '12345679', invite_state: 'Accepted', api_status: 'OK', last_sync: '2026-10-05T09:12:00Z', status_history: [{ at: '2025-11-20T12:31:00Z', from: 'Not sent', to: 'Sent' }, { at: '2025-11-21T09:04:00Z', from: 'Sent', to: 'Accepted' }] },
  { id: 'rel_03', site: 'northstar-games.io', partner_ticket: 'AGX-1001', mcm_id: 'MCM-001', network_code: '12345681', invite_state: 'Sent', api_status: 'NOT_INVITED', last_sync: '2026-10-02T16:20:00Z', status_history: [{ at: '2026-10-02T16:19:00Z', from: 'Not sent', to: 'Sent' }] },
  { id: 'rel_04', site: 'northstar-weekly.com', partner_ticket: 'AGX-1001', mcm_id: 'MCM-001', network_code: '12345682', invite_state: 'Sent', api_status: 'SYNCING', last_sync: '2026-10-05T08:40:00Z', status_history: [{ at: '2026-09-30T11:02:00Z', from: 'Not sent', to: 'Sent' }] },
  { id: 'rel_05', site: 'northstar-video.tv', partner_ticket: 'AGX-1001', mcm_id: 'MCM-001', network_code: '12345683', invite_state: 'Expired', api_status: 'API_ERROR', last_sync: '2026-08-01T05:15:00Z', status_history: [{ at: '2026-06-11T09:00:00Z', from: 'Not sent', to: 'Sent' }, { at: '2026-07-11T09:00:00Z', from: 'Sent', to: 'Expired' }] },
  { id: 'rel_06', site: 'atlasdaily.co', partner_ticket: 'AGX-1002', mcm_id: 'MCM-001', network_code: '22001100', invite_state: 'Sent', api_status: 'SYNCING', last_sync: '2026-10-05T09:10:00Z', status_history: [{ at: '2026-10-03T14:22:00Z', from: 'Not sent', to: 'Sent' }] },
  { id: 'rel_07', site: 'atlasbiz.com', partner_ticket: 'AGX-1002', mcm_id: 'MCM-001', network_code: '22001101', invite_state: 'Accepted', api_status: 'OK', last_sync: '2026-10-05T09:12:00Z', status_history: [{ at: '2025-12-22T10:11:00Z', from: 'Not sent', to: 'Sent' }, { at: '2025-12-23T07:45:00Z', from: 'Sent', to: 'Accepted' }] },
  { id: 'rel_08', site: 'atlasweekend.co', partner_ticket: 'AGX-1002', mcm_id: 'MCM-001', network_code: '22001103', invite_state: 'Withdrawn', api_status: 'NOT_INVITED', last_sync: '2026-07-18T10:04:00Z', status_history: [{ at: '2026-03-15T09:30:00Z', from: 'Not sent', to: 'Sent' }, { at: '2026-04-04T10:15:00Z', from: 'Sent', to: 'Accepted' }, { at: '2026-07-18T10:04:00Z', from: 'Accepted', to: 'Withdrawn' }] },
  { id: 'rel_09', site: 'signalwire.tv', partner_ticket: 'AGX-1004', mcm_id: 'MCM-001', network_code: '44003301', invite_state: 'Accepted', api_status: 'OK', last_sync: '2026-10-05T09:12:00Z', status_history: [{ at: '2026-02-03T13:00:00Z', from: 'Not sent', to: 'Sent' }, { at: '2026-02-04T09:40:00Z', from: 'Sent', to: 'Accepted' }] },
  { id: 'rel_10', site: 'signalhouse.media', partner_ticket: 'AGX-1004', mcm_id: 'MCM-001', network_code: '44003300', invite_state: 'Withdrawn', api_status: 'API_ERROR', last_sync: '2026-09-12T11:55:00Z', status_history: [{ at: '2026-01-30T10:00:00Z', from: 'Not sent', to: 'Sent' }, { at: '2026-08-15T15:12:00Z', from: 'Accepted', to: 'Withdrawn' }] },
  { id: 'rel_11', site: 'coastalwire.news', partner_ticket: 'AGX-1005', mcm_id: 'MCM-001', network_code: '55004400', invite_state: 'Expired', api_status: 'API_ERROR', last_sync: '2026-08-30T04:31:00Z', status_history: [{ at: '2025-10-15T09:00:00Z', from: 'Not sent', to: 'Sent' }, { at: '2026-07-29T09:00:00Z', from: 'Sent', to: 'Expired' }] },
  { id: 'rel_12', site: 'vertexlabs.io', partner_ticket: 'AGX-1006', mcm_id: 'MCM-001', network_code: '66005500', invite_state: 'Accepted', api_status: 'OK', last_sync: '2026-10-05T09:12:00Z', status_history: [{ at: '2026-04-05T10:20:00Z', from: 'Not sent', to: 'Sent' }, { at: '2026-04-06T08:12:00Z', from: 'Sent', to: 'Accepted' }] },
  { id: 'rel_13', site: 'harborline.news', partner_ticket: 'AGX-1007', mcm_id: 'MCM-001', network_code: '77006600', invite_state: 'Accepted', api_status: 'OK', last_sync: '2026-10-05T09:12:00Z', status_history: [{ at: '2026-05-20T09:44:00Z', from: 'Not sent', to: 'Sent' }, { at: '2026-05-21T11:03:00Z', from: 'Sent', to: 'Accepted' }] },
  { id: 'rel_14', site: 'harborpost.com', partner_ticket: 'AGX-1007', mcm_id: 'MCM-001', network_code: '77006601', invite_state: 'Accepted', api_status: 'SYNCING', last_sync: '2026-10-05T09:05:00Z', status_history: [{ at: '2026-06-24T08:15:00Z', from: 'Not sent', to: 'Sent' }, { at: '2026-06-25T13:40:00Z', from: 'Sent', to: 'Accepted' }] },
]

/** Adapter surface every MCM provider must implement (§13.3). */
export const integrationContract = [
  'authenticate()', 'health_check()', 'get_sites()', 'create_site()', 'invite_site()',
  'resend_invite()', 'withdraw_site()', 'check_status()', 'fetch_report()',
  'fetch_adjustments()', 'map_external_status()',
]

export const inviteLog = [
  { at: '2026-10-05T09:12:00Z', op: 'status_sync', site: 'all (23)', result: 'OK', duration: '1.9s' },
  { at: '2026-10-05T08:40:00Z', op: 'check_status', site: 'northstar-weekly.com', result: 'OK', duration: '0.4s' },
  { at: '2026-10-04T16:12:00Z', op: 'invite_site', site: 'vertexdaily.com', result: 'OK', duration: '1.2s' },
  { at: '2026-10-03T14:22:00Z', op: 'invite_site', site: 'atlasdaily.co', result: 'OK', duration: '1.1s' },
  { at: '2026-10-02T16:19:00Z', op: 'invite_site', site: 'northstar-games.io', result: 'OK', duration: '1.3s' },
  { at: '2026-10-01T09:55:00Z', op: 'fetch_report', site: 'batch 2026-09', result: 'OK', duration: '12.6s' },
  { at: '2026-09-30T22:14:00Z', op: 'status_sync', site: 'all', result: 'RETRY (1/3)', duration: 'timeout' },
  { at: '2026-09-30T22:16:00Z', op: 'status_sync', site: 'all', result: 'OK', duration: '3.4s' },
]
