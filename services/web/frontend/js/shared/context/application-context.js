import React, { createContext, useContext } from 'react'
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
  const applicationContextValue = {
    user: window.user,
    gitBridgePublicBaseUrl: window.gitBridgePublicBaseUrl,
  }
  return (
    <ApplicationContext.Provider value={applicationContextValue}>
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
