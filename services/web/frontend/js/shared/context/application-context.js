import React, { createContext, useContext } from 'react'
import PropTypes from 'prop-types'

export const ApplicationContext = createContext()

export function ApplicationProvider({ children }) {
  return (
    <ApplicationContext.Provider
      value={{
        user: window.user
      }}
    >
      {children}
    </ApplicationContext.Provider>
  )
}

ApplicationProvider.propTypes = {
  children: PropTypes.any
}

export function useApplicationContext() {
  const { user } = useContext(ApplicationContext)
  return {
    user
  }
}
