type TemplateKey =
  | 'notification_project_invite'
  | 'wfh_2020_upgrade_offer'
  | 'notification_ip_matched_affiliation'
  | 'notification_tpds_file_limit'
  | 'notification_dropbox_duplicate_project_names'
  | 'notification_dropbox_unlinked_due_to_lapsed_reconfirmation'
  | 'notification_group_invitation'
  | 'notification_personal_and_group_subscriptions'

type NotificationBase = {
  _id?: number
  html?: string
  templateKey: TemplateKey | string
}

export interface NotificationProjectInvite extends NotificationBase {
  templateKey: Extract<TemplateKey, 'notification_project_invite'>
  messageOpts: {
    projectName: string
    userName: string
    projectId: number | string
    token: string
  }
}

interface NotificationWFH2020UpgradeOffer extends NotificationBase {
  templateKey: Extract<TemplateKey, 'wfh_2020_upgrade_offer'>
}

export interface NotificationIPMatchedAffiliation extends NotificationBase {
  templateKey: Extract<TemplateKey, 'notification_ip_matched_affiliation'>
  messageOpts: {
    university_name: string
    ssoEnabled: boolean
    portalPath?: string
    institutionId: string
  }
}

export interface NotificationTPDSFileLimit extends NotificationBase {
  templateKey: Extract<TemplateKey, 'notification_tpds_file_limit'>
  messageOpts: {
    projectName: string
    projectId?: string
  }
}

export interface NotificationDropboxDuplicateProjectNames
  extends NotificationBase {
  templateKey: Extract<
    TemplateKey,
    'notification_dropbox_duplicate_project_names'
  >
  messageOpts: {
    projectName: string
  }
}

interface NotificationDropboxUnlinkedDueToLapsedReconfirmation
  extends NotificationBase {
  templateKey: Extract<
    TemplateKey,
    'notification_dropbox_unlinked_due_to_lapsed_reconfirmation'
  >
}

export interface NotificationGroupInvitation extends NotificationBase {
  templateKey: Extract<TemplateKey, 'notification_group_invitation'>
  messageOpts: {
    token: string
    inviterName: string
    managedUsersEnabled: boolean
  }
}

export type Notification =
  | NotificationProjectInvite
  | NotificationWFH2020UpgradeOffer
  | NotificationIPMatchedAffiliation
  | NotificationTPDSFileLimit
  | NotificationDropboxDuplicateProjectNames
  | NotificationDropboxUnlinkedDueToLapsedReconfirmation
  | NotificationGroupInvitation

export type Institution = {
  _id?: number
  email: string
  institutionEmail: string
  institutionId: number | string
  institutionName: string
  requestedEmail: string
  templateKey: string
  error?: {
    translatedMessage?: string
    message?: string
    tryAgain?: boolean
  }
}

export type PendingGroupSubscriptionEnrollment = {
  groupId: string
  groupName: string
}

export const GroupsAndEnterpriseBannerVariants = ['on-premise', 'FOMO'] as const
export type GroupsAndEnterpriseBannerVariant =
  (typeof GroupsAndEnterpriseBannerVariants)[number]

export const USGovBannerVariants = [
  'government-purchasing',
  'small-business-reseller',
] as const
export type USGovBannerVariant = (typeof USGovBannerVariants)[number]
