/**
 * Support-ticket vocabulary shared by the partner portal UI and the API
 * routes. Kept free of Node imports so the client bundle can use the labels
 * and the server can enforce the same allow-lists.
 *
 * Every ticket row carries `partner_tag`, the same value matched against the
 * suffix of `network_codes.label`. That is the only link between a ticket and
 * the sites it concerns, and it always comes from the session — never from the
 * request body — so a partner cannot file tickets on behalf of another tag.
 */

export const TICKET_CATEGORIES = ['BILLING', 'TECHNICAL', 'ACCOUNT', 'POLICY', 'OTHER'] as const
export type TicketCategory = (typeof TICKET_CATEGORIES)[number]

export const TICKET_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

/**
 * OPEN -> IN_PROGRESS -> WAITING (on the partner) -> RESOLVED -> CLOSED.
 * Partners may reopen a RESOLVED ticket by replying; only support moves a
 * ticket to CLOSED.
 */
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  BILLING: 'Billing & payments',
  TECHNICAL: 'Technical',
  ACCOUNT: 'Account & access',
  POLICY: 'Policy & compliance',
  OTHER: 'Something else',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING: 'Waiting on you',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

/** Statuses a partner still expects a reply on — used for the open-count chip. */
export const ACTIVE_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING']

export function isTicketCategory(v: unknown): v is TicketCategory {
  return typeof v === 'string' && (TICKET_CATEGORIES as readonly string[]).includes(v)
}

export function isTicketPriority(v: unknown): v is TicketPriority {
  return typeof v === 'string' && (TICKET_PRIORITIES as readonly string[]).includes(v)
}

export function isTicketStatus(v: unknown): v is TicketStatus {
  return typeof v === 'string' && (TICKET_STATUSES as readonly string[]).includes(v)
}

export interface TicketRow {
  ticketId: string
  partnerTag: string
  subject: string
  description: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  assignedTo: string | null
  createdBy: { userId: string | null; name: string | null; email: string | null }
  createdAt: string | null
  updatedAt: string | null
  resolvedAt: string | null
  lastMessageAt: string | null
  messageCount: number
}

export interface TicketMessage {
  messageId: string
  ticketId: string
  senderType: 'PARTNER' | 'SUPPORT'
  senderName: string | null
  senderEmail: string | null
  body: string
  createdAt: string | null
}

export interface TicketHistoryEntry {
  historyId: string
  action: string
  field: string | null
  fromValue: string | null
  toValue: string | null
  actorType: 'PARTNER' | 'SUPPORT' | 'SYSTEM'
  actorName: string | null
  createdAt: string | null
}
