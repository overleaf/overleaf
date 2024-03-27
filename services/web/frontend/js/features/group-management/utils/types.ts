export type GroupUserAlertVariant =
  | 'resendManagedUserInviteSuccess'
  | 'resendManagedUserInviteFailed'
  | 'resendGroupInviteSuccess'
  | 'resendGroupInviteFailed'
  | 'resendInviteTooManyRequests'
  | 'resendSSOLinkInviteSuccess'
  | 'resendSSOLinkInviteFailed'

export type GroupUserAlert =
  | {
      variant: GroupUserAlertVariant
      email?: string
    }
  | undefined
