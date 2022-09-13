export type Notification = {
  _id?: number
  templateKey: string
  messageOpts: {
    projectId: number | string
    projectName: string
    portalPath?: string
    ssoEnabled: boolean
    institutionId: string
    userName: string
    university_name: string
    token: string
  }
  html?: string
}

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
