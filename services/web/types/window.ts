import { ExposedSettings } from './exposed-settings'
import { OAuthProviders } from './oauth-providers'

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    sl_debugging: boolean
    user: {
      id: string
    }
    oauthProviders: OAuthProviders
    thirdPartyIds: Record<string, string>
    metaAttributesCache: Map<string, any>
    i18n: {
      currentLangCode: string
    }
    ExposedSettings: ExposedSettings
  }
}
