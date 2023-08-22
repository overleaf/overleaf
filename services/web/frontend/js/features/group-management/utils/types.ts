export type ManagedUserAlertVariant =
  | 'resendManagedUserInviteSuccess'
  | 'resendManagedUserInviteFailed'
  | 'resendManagedUserInviteTooManyRequests'

export type ManagedUserAlert =
  | {
      variant: ManagedUserAlertVariant
      email?: string
    }
  | undefined
