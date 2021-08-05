import { createContext, useContext } from 'react'
import PropTypes from 'prop-types'
import useScopeValue from './util/scope-value-hook'

export const UserContext = createContext()

UserContext.Provider.propTypes = {
  value: PropTypes.shape({
    user: PropTypes.shape({
      id: PropTypes.string,
      allowedFreeTrial: PropTypes.boolean,
      first_name: PropTypes.string,
      last_name: PropTypes.string,
    }),
  }),
}

export function UserProvider({ children }) {
  const [user] = useScopeValue('user', true)

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

UserProvider.propTypes = {
  children: PropTypes.any,
}

export function useUserContext(propTypes) {
  const data = useContext(UserContext)
  PropTypes.checkPropTypes(propTypes, data, 'data', 'UserContext.Provider')
  return data
}
