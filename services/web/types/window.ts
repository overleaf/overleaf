import 'recurly__recurly-js'
import { ScopeValueStore } from './ide/scope-value-store'
import { MetaAttributesCache } from '@/utils/meta'
import { ReCaptchaInstance } from './recaptcha'
import { WritefullWindow } from './writefull/writefull-window'

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    metaAttributesCache: MetaAttributesCache
    MathJax: Record<string, any>
    // For react-google-recaptcha
    recaptchaOptions?: {
      enterprise?: boolean
      useRecaptchaNet?: boolean
    }
    expectingLinkedFileRefreshedSocketFor?: string | null
    writefull?: WritefullWindow
    WritefullStub?: any
    io?: any
    overleaf: {
      unstable: {
        store: ScopeValueStore
      }
    }
    ga?: (...args: any) => void
    gtag?: (...args: any) => void

    propensity?: (propensityId?: string) => void
    olLoadGA?: () => void
    grecaptcha?: ReCaptchaInstance
    _linkedin_data_partner_ids?: string[]
    lintrk?: ((a: string, b?: unknown) => void) & {
      q: Array<[string, unknown?]>
    }
  }
}
