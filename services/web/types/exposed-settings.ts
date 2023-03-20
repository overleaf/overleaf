type TemplateLink = {
  name: string
  url: string
  trackingKey: string
}

export type ExposedSettings = {
  adminEmail: string
  appName: string
  cookieDomain: string
  dropboxAppName: string
  emailConfirmationDisabled: boolean
  enableSubscriptions: boolean
  gaToken?: string
  gaTokenV4?: string
  hasAffiliationsFeature: boolean
  hasLinkUrlFeature: boolean
  hasLinkedProjectFileFeature: boolean
  hasLinkedProjectOutputFileFeature: boolean
  hasSamlBeta?: boolean
  hasSamlFeature: boolean
  isOverleaf: boolean
  maxEntitiesPerProject: number
  maxUploadSize: number
  recaptchaDisabled: {
    invite: boolean
    login: boolean
    passwordReset: boolean
    register: boolean
  }
  recaptchaSiteKeyV3?: string
  samlInitPath?: string
  sentryAllowedOriginRegex: string
  sentryDsn?: string
  sentryEnvironment?: string
  sentryRelease?: string
  siteUrl: string
  textExtensions: string[]
  validRootDocExtensions: string[]
  templateLinks?: TemplateLink[]
  labsEnabled: boolean
}
