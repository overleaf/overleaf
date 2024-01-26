import { createContext, FC, useContext } from 'react'
import getMeta from '../../utils/meta'
import { User } from '../../../../types/user'

export const UserContext = createContext<User | undefined>(undefined)

export const UserProvider: FC = ({ children }) => {
  const user = getMeta('ol-user')

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useUserContext() {
  const context = useContext(UserContext)

  if (!context) {
    throw new Error(
      'useUserContext is only available inside UserContext, or `ol-user` meta is not defined'
    )
  }

  return context
}
