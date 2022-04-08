export type OAuthProvider = {
  name: string
  descriptionKey: string
  linkPath: string
}

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    sl_debugging: boolean
    user: {
      id: string
    }
    oauthProviders: Record<string, OAuthProvider>
    thirdPartyIds: Record<string, string>
    metaAttributesCache: Map<string, unknown>
    i18n: {
      currentLangCode: string
    }
    ExposedSettings: Record<string, unknown>
  }
}
