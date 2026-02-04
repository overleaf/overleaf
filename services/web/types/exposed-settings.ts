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
  hotjarId?: string
  hotjarVersion?: string
  ieeeBrandId: number
  isOverleaf: boolean
  maxEntitiesPerProject: number
  projectUploadTimeout: number
  propensityId?: string
  maxUploadSize: number
  recaptchaDisabled: {
    invite: boolean
    login: boolean
    passwordReset: boolean
    register: boolean
    addEmail: boolean
  }
  recaptchaSiteKeyV3?: string
  recaptchaSiteKey?: string
  samlInitPath?: string
  sentryAllowedOriginRegex: string
  sentryDsn?: string
  sentryEnvironment?: string
  sentryRelease?: string
  siteUrl: string
  textExtensions: string[]
  editableFilenames: string[]
  validRootDocExtensions: string[]
  fileIgnorePattern: string
  templateLinks?: TemplateLink[]
  labsEnabled: boolean
  wikiEnabled?: boolean
  templatesEnabled?: boolean
  linkedInInsightsPartnerId?: string
}
