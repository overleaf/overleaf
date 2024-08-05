import 'recurly__recurly-js'
import { ScopeValueStore } from './ide/scope-value-store'

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    metaAttributesCache: Map<string, any>
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
    _reportCM6Perf: () => void
    MathJax: Record<string, any>
    crypto: {
      randomUUID: () => string
    }
    // For react-google-recaptcha
    recaptchaOptions?: {
      enterprise?: boolean
      useRecaptchaNet?: boolean
    }
    expectingLinkedFileRefreshedSocketFor?: string | null
    writefull?: {
      type: 'extension' | 'integration'
    }
    WritefullStub?: any
    io?: any
    overleaf: {
      unstable: {
        store: ScopeValueStore
      }
    }
  }
}
