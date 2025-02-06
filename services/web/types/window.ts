import 'recurly__recurly-js'
import { ScopeValueStore } from './ide/scope-value-store'
import { MetaAttributesCache } from '@/utils/meta'
import { Socket } from '@/features/ide-react/connection/types/socket'

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    metaAttributesCache: MetaAttributesCache
    _ide: Record<string, unknown> & {
      $scope: Record<string, unknown> & {
        pdf?: {
          logEntryAnnotations: Record<string, unknown>
        }
      }
      socket: Socket
    }
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
    ga?: (...args: any) => void
    gtag?: (...args: any) => void
  }
}
