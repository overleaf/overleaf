export type ManagedUserAlertVariant =
  | 'resendManagedUserInviteSuccess'
  | 'resendManagedUserInviteFailed'
  | 'resendGroupInviteSuccess'
  | 'resendGroupInviteFailed'
  | 'resendInviteTooManyRequests'
  | 'resendSSOLinkInviteSuccess'
  | 'resendSSOLinkInviteFailed'

export type ManagedUserAlert =
  | {
      variant: ManagedUserAlertVariant
      email?: string
    }
  | undefined
