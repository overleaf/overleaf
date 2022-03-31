import { createContext, useContext, useState } from 'react'
import PropTypes from 'prop-types'
import { getMockIde } from './mock/mock-ide'

const IdeContext = createContext()

IdeContext.Provider.propTypes = {
  value: PropTypes.shape({
    $scope: PropTypes.object.isRequired,
  }),
}

export function useIdeContext() {
  const context = useContext(IdeContext)

  if (!context) {
    throw new Error('useIdeContext is only available inside IdeProvider')
  }

  return context
}

export function IdeProvider({ ide, children }) {
  const [value] = useState(() => ide || getMockIde())

  return <IdeContext.Provider value={value}>{children}</IdeContext.Provider>
}
IdeProvider.propTypes = {
  children: PropTypes.any.isRequired,
  ide: PropTypes.shape({
    $scope: PropTypes.object.isRequired,
  }),
}
