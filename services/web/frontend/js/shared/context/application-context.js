import React, { createContext, useContext } from 'react'
import PropTypes from 'prop-types'
import ExposedSettings from '../../main/exposed-settings'

export const ApplicationContext = createContext()

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

export function useApplicationContext() {
  const applicationContext = useContext(ApplicationContext)
  return applicationContext
}
