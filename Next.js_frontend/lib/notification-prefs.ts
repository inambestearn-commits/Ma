/**
 * Default notification preferences for a partner account.
 *
 * Lives in its own module with no imports so both the server session reader
 * (`lib/partner.ts`) and the client settings form can share it. Putting it in
 * `lib/partner.ts` would drag `next/headers` into the client bundle.
 */
export const DEFAULT_NOTIFICATION_PREFS: Record<string, boolean> = {
  payment: true,
  policy: true,
  smartAlert: true,
  invite: true,
  withdrawn: false,
  mcm: true,
  digest: false,
}
