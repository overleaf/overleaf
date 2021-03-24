import React, { createContext, useContext, useState } from 'react'
import PropTypes from 'prop-types'

const FileTreeMainContext = createContext()

export function useFileTreeMainContext() {
  const context = useContext(FileTreeMainContext)

  if (!context) {
    throw new Error(
      'useFileTreeMainContext is only available inside FileTreeMainProvider'
    )
  }

  return context
}

export const FileTreeMainProvider = function({
  projectId,
  hasWritePermissions,
  userHasFeature,
  refProviders,
  reindexReferences,
  setRefProviderEnabled,
  setStartedFreeTrial,
  children
}) {
  const [contextMenuCoords, setContextMenuCoords] = useState()

  return (
    <FileTreeMainContext.Provider
      value={{
        projectId,
        hasWritePermissions,
        userHasFeature,
        refProviders,
        reindexReferences,
        setRefProviderEnabled,
        setStartedFreeTrial,
        contextMenuCoords,
        setContextMenuCoords
      }}
    >
      {children}
    </FileTreeMainContext.Provider>
  )
}

FileTreeMainProvider.propTypes = {
  projectId: PropTypes.string.isRequired,
  hasWritePermissions: PropTypes.bool.isRequired,
  userHasFeature: PropTypes.func.isRequired,
  reindexReferences: PropTypes.func.isRequired,
  refProviders: PropTypes.object.isRequired,
  setRefProviderEnabled: PropTypes.func.isRequired,
  setStartedFreeTrial: PropTypes.func.isRequired,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node
  ]).isRequired
}
