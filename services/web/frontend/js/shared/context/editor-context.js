import React, { createContext, useContext } from 'react'
import PropTypes from 'prop-types'

export const EditorContext = createContext()

export function EditorProvider({ children }) {
  return (
    <EditorContext.Provider
      value={{
        projectId: window.project_id
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}

EditorProvider.propTypes = {
  children: PropTypes.any
}

export function useEditorContext() {
  const { projectId } = useContext(EditorContext)
  return {
    projectId
  }
}
