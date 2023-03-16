import {
  createContext,
  useCallback,
  useContext,
  useState,
  useMemo,
  ReactNode,
} from 'react'
import { postJSON } from '../../../infrastructure/fetch-json'
import useIsMounted from '../../../shared/hooks/use-is-mounted'
import { set, cloneDeep } from 'lodash'
import getMeta from '../../../utils/meta'
import type {
  OAuthProviders,
  OAuthProvider,
} from '../../../../../types/oauth-providers'
import type { ThirdPartyIds } from '../../../../../types/third-party-ids'

export type SSOSubscription = {
  providerId: string
  provider: OAuthProvider
  linked: boolean
}

type SSOContextValue = {
  subscriptions: Record<string, SSOSubscription>
  unlink: (id: string, signal?: AbortSignal) => Promise<void>
}

export const SSOContext = createContext<SSOContextValue | undefined>(undefined)

type SSOProviderProps = {
  children: ReactNode
}

export function SSOProvider({ children }: SSOProviderProps) {
  const isMounted = useIsMounted()
  const oauthProviders = getMeta('ol-oauthProviders', {}) as OAuthProviders
  const thirdPartyIds = getMeta('ol-thirdPartyIds') as ThirdPartyIds

  const [subscriptions, setSubscriptions] = useState<
    Record<string, SSOSubscription>
  >(() => {
    const initialSubscriptions: Record<string, SSOSubscription> = {}
    for (const [id, provider] of Object.entries(oauthProviders)) {
      const linked = !!thirdPartyIds[id]
      if (!provider.hideWhenNotLinked || linked) {
        initialSubscriptions[id] = {
          providerId: id,
          provider,
          linked,
        }
      }
    }
    return initialSubscriptions
  })

  const unlink = useCallback(
    (providerId: string, signal?: AbortSignal) => {
      if (!subscriptions[providerId].linked) {
        return Promise.resolve()
      }
      const body = {
        link: false,
        providerId,
      }

      return postJSON('/user/oauth-unlink', { body, signal }).then(() => {
        if (isMounted.current) {
          setSubscriptions(subs =>
            set(cloneDeep(subs), `${providerId}.linked`, false)
          )
        }
      })
    },
    [isMounted, subscriptions]
  )

  const value = useMemo<SSOContextValue>(
    () => ({
      subscriptions,
      unlink,
    }),
    [subscriptions, unlink]
  )

  return <SSOContext.Provider value={value}>{children}</SSOContext.Provider>
}

export function useSSOContext() {
  const context = useContext(SSOContext)
  if (!context) {
    throw new Error('SSOContext is only available inside SSOProvider')
  }
  return context
}
