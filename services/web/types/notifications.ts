type GlobalNotificationPreferences = {
  muteAllNotifications: boolean
}

export type UserNotificationPreferences = {
  newsletter: boolean
} & GlobalNotificationPreferences
