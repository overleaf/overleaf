import { ExposedSettings } from './exposed-settings'
import { OAuthProviders } from './oauth-providers'
import { OverallThemeMeta } from './project-settings'
import { User } from './user'
import 'recurly__recurly-js'

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    csrfToken: string
    sl_debugging: boolean
    user: User
    user_id?: string
    oauthProviders: OAuthProviders
    thirdPartyIds: Record<string, string>
    metaAttributesCache: Map<string, any>
    i18n: {
      currentLangCode: string
    }
    ExposedSettings: ExposedSettings
    project_id: string
    gitBridgePublicBaseUrl: string
    _ide: Record<string, unknown> & {
      $scope: Record<string, unknown> & {
        pdf?: {
          logEntryAnnotations: Record<string, unknown>
        }
      }
    }
    isRestrictedTokenMember: boolean
    _reportCM6Perf: () => void
    _reportAcePerf: () => void
    MathJax: Record<string, any>
    overallThemes: OverallThemeMeta[]
    crypto: {
      randomUUID: () => string
    }
  }
}
