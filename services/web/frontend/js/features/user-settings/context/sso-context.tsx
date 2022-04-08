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

type SSOSubscription = {
  name: string
  descriptionKey: string
  linked?: boolean
  linkPath: string
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
  const isMountedRef = useIsMounted()

  const [subscriptions, setSubscriptions] = useState(() => {
    const initialSubscriptions: Record<string, SSOSubscription> = {}
    for (const [id, provider] of Object.entries(window.oauthProviders)) {
      initialSubscriptions[id] = {
        descriptionKey: provider.descriptionKey,
        name: provider.name,
        linkPath: provider.linkPath,
        linked: !!window.thirdPartyIds[id],
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
        if (isMountedRef.current) {
          setSubscriptions(subs =>
            set(cloneDeep(subs), `${providerId}.linked`, false)
          )
        }
      })
    },
    [isMountedRef, subscriptions]
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
