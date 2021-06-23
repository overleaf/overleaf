import { createContext, useContext } from 'react'
import PropTypes from 'prop-types'

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
  return <IdeContext.Provider value={ide}>{children}</IdeContext.Provider>
}
IdeProvider.propTypes = {
  children: PropTypes.any.isRequired,
  ide: PropTypes.shape({
    $scope: PropTypes.object.isRequired,
  }).isRequired,
}
