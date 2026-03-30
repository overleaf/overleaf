import { useCallback, useState } from 'react'
import { useUserContext } from '@/shared/context/user-context'
import { useReceiveUser } from './use-receive-user'
import { User } from '../../../../../types/user'

export const useRefProviders = (): User['refProviders'] => {
  const user = useUserContext()
  const [refProviders, setRefProviders] = useState(user.refProviders)

  useReceiveUser(
    useCallback(data => {
      if (data?.refProviders) {
        setRefProviders(data.refProviders)
      }
    }, [])
  )

  return refProviders
}
