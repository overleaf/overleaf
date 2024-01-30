import { ExposedSettings } from './exposed-settings'
import { OAuthProviders } from './oauth-providers'
import { OverallThemeMeta } from './project-settings'
import { User } from './user'
import 'recurly__recurly-js'
import { UserSettings } from './user-settings'
import { ScopeValueStore } from './ide/scope-value-store'

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    csrfToken: string
    user: User
    user_id?: string
    userSettings: UserSettings
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
      socket: {
        on: (event: string, listener: any) => void
        removeListener: (event: string, listener: any) => void
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
    // For react-google-recaptcha
    recaptchaOptions?: {
      enterprise?: boolean
      useRecaptchaNet?: boolean
    }
    brandVariation?: Record<string, any>
    data?: Record<string, any>
    expectingLinkedFileRefreshedSocketFor?: string | null
    writefull?: {
      type: 'extension' | 'integration'
    }
    io?: any
    overleaf: {
      unstable: {
        store: ScopeValueStore
      }
    }
  }
}
