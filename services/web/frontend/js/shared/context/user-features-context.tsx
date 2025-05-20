import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { User } from '../../../../types/user'
import { useUserContext } from './user-context'
import { useReceiveUser } from '../hooks/user-channel/use-receive-user'
import { getJSON } from '@/infrastructure/fetch-json'
import { useEditorContext } from './editor-context'

export const UserFeaturesContext = createContext<User['features']>(undefined)

export const UserFeaturesProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const user = useUserContext()
  const { writefullInstance } = useEditorContext()
  const [features, setFeatures] = useState(user.features || {})

  useReceiveUser(
    useCallback(data => {
      if (data?.features) {
        setFeatures(data.features)
      }
    }, [])
  )

  useEffect(() => {
    const listener = async ({ isPremium }: { isPremium: boolean }) => {
      if (features?.aiErrorAssistant === isPremium) {
        // the user is premium on writefull and has the AI assist, no need to refresh the features
        return
      }
      const newFeatures = await getJSON('/user/features')
      setFeatures(newFeatures)
    }

    writefullInstance?.addEventListener('writefull-login-complete', listener)

    return () => {
      writefullInstance?.removeEventListener(
        'writefull-login-complete',
        listener
      )
    }
  }, [features?.aiErrorAssistant, writefullInstance])

  return (
    <UserFeaturesContext.Provider value={features}>
      {children}
    </UserFeaturesContext.Provider>
  )
}

export function useUserFeaturesContext() {
  const context = useContext(UserFeaturesContext)

  if (!context) {
    throw new Error(
      'useUserFeaturesContext is only available inside UserFeaturesContext'
    )
  }

  return context
}
