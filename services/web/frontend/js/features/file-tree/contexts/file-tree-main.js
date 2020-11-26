import React, { createContext, useState } from 'react'
import PropTypes from 'prop-types'

export const FileTreeMainContext = createContext({})

export const FileTreeMainProvider = function({
  projectId,
  hasWritePermissions,
  children
}) {
  const [contextMenuCoords, setContextMenuCoords] = useState()

  return (
    <FileTreeMainContext.Provider
      value={{
        projectId,
        hasWritePermissions,
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
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node
  ]).isRequired
}
