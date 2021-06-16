import React, { createContext, useContext } from 'react'
import PropTypes from 'prop-types'
import useScopeValue from './util/scope-value-hook'

export const CompileContext = createContext()

CompileContext.Provider.propTypes = {
  value: PropTypes.shape({
    pdfUrl: PropTypes.string,
    pdfDownloadUrl: PropTypes.string,
    logEntries: PropTypes.object,
    uncompiled: PropTypes.bool,
  }),
}

export function CompileProvider({ children }) {
  const [pdfUrl] = useScopeValue('pdf.url')
  const [pdfDownloadUrl] = useScopeValue('pdf.downloadUrl')
  const [logEntries] = useScopeValue('pdf.logEntries')
  const [uncompiled] = useScopeValue('pdf.uncompiled')

  const value = {
    pdfUrl,
    pdfDownloadUrl,
    logEntries,
    uncompiled,
  }

  return (
    <CompileContext.Provider value={value}>{children}</CompileContext.Provider>
  )
}

CompileProvider.propTypes = {
  children: PropTypes.any,
}

export function useCompileContext(propTypes) {
  const data = useContext(CompileContext)
  PropTypes.checkPropTypes(propTypes, data, 'data', 'CompileContext.Provider')
  return data
}
