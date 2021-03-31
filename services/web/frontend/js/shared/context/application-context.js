import React, { createContext, useContext } from 'react'
import PropTypes from 'prop-types'
import ExposedSettings from '../../main/exposed-settings'

export const ApplicationContext = createContext()

ApplicationContext.Provider.propTypes = {
  value: PropTypes.shape({
    user: PropTypes.shape({
      id: PropTypes.string.isRequired
    }),
    exposedSettings: PropTypes.shape({
      enableSubscriptions: PropTypes.bool
    })
  })
}

export function ApplicationProvider({ children }) {
  const applicationContextValue = {
    user: window.user,
    exposedSettings: ExposedSettings
  }
  return (
    <ApplicationContext.Provider value={applicationContextValue}>
      {children}
    </ApplicationContext.Provider>
  )
}

ApplicationProvider.propTypes = {
  children: PropTypes.any
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
