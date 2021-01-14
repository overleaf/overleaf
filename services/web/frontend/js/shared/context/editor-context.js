import React, { createContext, useContext } from 'react'
import PropTypes from 'prop-types'

export const EditorContext = createContext()

export function EditorProvider({ children }) {
  const ownerId =
    window._ide.$scope.project && window._ide.$scope.project.owner
      ? window._ide.$scope.project.owner._id
      : null

  const editorContextValue = {
    projectId: window.project_id,
    isProjectOwner: ownerId === window.user.id
  }

  return (
    <EditorContext.Provider value={editorContextValue}>
      {children}
    </EditorContext.Provider>
  )
}

EditorProvider.propTypes = {
  children: PropTypes.any
}

export function useEditorContext() {
  const editorContext = useContext(EditorContext)
  return editorContext
}
