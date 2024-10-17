import { createContext, FC, useContext, useMemo } from 'react'
import getMeta from '../../utils/meta'
import { LoggedOutUser, User } from '../../../../types/user'

export const UserContext = createContext<User | LoggedOutUser | undefined>(
  undefined
)

export const UserProvider: FC = ({ children }) => {
  const user = useMemo(() => getMeta('ol-user'), [])

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
