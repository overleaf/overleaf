import React, { createContext, useContext, useState } from 'react'
import PropTypes from 'prop-types'

const FileTreeCreateFormContext = createContext()

export const useFileTreeCreateForm = () => {
  const context = useContext(FileTreeCreateFormContext)

  if (!context) {
    throw new Error(
      'useFileTreeCreateForm is only available inside FileTreeCreateFormProvider'
    )
  }

  return context
}

export default function FileTreeCreateFormProvider({ children }) {
  // is the form valid
  const [valid, setValid] = useState(false)

  return (
    <FileTreeCreateFormContext.Provider value={{ valid, setValid }}>
      {children}
    </FileTreeCreateFormContext.Provider>
  )
}

FileTreeCreateFormProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
}
