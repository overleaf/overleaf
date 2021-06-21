import React, { createContext, useContext, useMemo } from 'react'
import PropTypes from 'prop-types'

export const ApplicationContext = createContext()

ApplicationContext.Provider.propTypes = {
  value: PropTypes.shape({
    user: PropTypes.shape({
      id: PropTypes.string.isRequired,
      firstName: PropTypes.string,
      lastName: PropTypes.string,
    }),
    gitBridgePublicBaseUrl: PropTypes.string.isRequired,
  }),
}

export function ApplicationProvider({ children }) {
  const value = useMemo(() => {
    const value = {
      gitBridgePublicBaseUrl: window.gitBridgePublicBaseUrl,
    }

    if (window.user.id) {
      value.user = window.user
    }

    return value
  }, [])

  return (
    <ApplicationContext.Provider value={value}>
      {children}
    </ApplicationContext.Provider>
  )
}

ApplicationProvider.propTypes = {
  children: PropTypes.any,
}

export function useApplicationContext(propTypes) {
  const data = useContext(ApplicationContext)
  PropTypes.checkPropTypes(
    propTypes,
    data,
    'data',
    'ApplicationContext.Provider'
  )
  return data
}
