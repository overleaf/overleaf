export type ManagedUserAlertVariant =
  | 'resendManagedUserInviteSuccess'
  | 'resendManagedUserInviteFailed'
  | 'resendGroupInviteSuccess'
  | 'resendGroupInviteFailed'
  | 'resendInviteTooManyRequests'

export type ManagedUserAlert =
  | {
      variant: ManagedUserAlertVariant
      email?: string
    }
  | undefined
