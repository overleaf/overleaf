import { createContext, useContext } from 'react'
import PropTypes from 'prop-types'
import getMeta from '../../utils/meta'

export const UserContext = createContext()

UserContext.Provider.propTypes = {
  value: PropTypes.shape({
    user: PropTypes.shape({
      id: PropTypes.string,
      isAdmin: PropTypes.boolean,
      email: PropTypes.string,
      allowedFreeTrial: PropTypes.boolean,
      first_name: PropTypes.string,
      last_name: PropTypes.string,
      features: PropTypes.shape({
        dropbox: PropTypes.boolean,
        github: PropTypes.boolean,
        mendeley: PropTypes.boolean,
        zotero: PropTypes.boolean,
        references: PropTypes.boolean,
      }),
      refProviders: PropTypes.shape({
        mendeley: PropTypes.any,
        zotero: PropTypes.any,
      }),
    }),
  }),
}

export function UserProvider({ children }) {
  const user = getMeta('ol-user')

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

UserProvider.propTypes = {
  children: PropTypes.any,
}

export function useUserContext(propTypes) {
  const data = useContext(UserContext)
  if (!data) {
    throw new Error(
      'useUserContext is only available inside UserContext, or `ol-user` meta is not defined'
    )
  }

  PropTypes.checkPropTypes(propTypes, data, 'data', 'UserContext.Provider')
  return data
}
