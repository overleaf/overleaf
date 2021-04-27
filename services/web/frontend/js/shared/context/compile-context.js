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

export function CompileProvider({ children, $scope }) {
  const [pdfUrl] = useScopeValue('pdf.url', $scope)
  const [pdfDownloadUrl] = useScopeValue('pdf.downloadUrl', $scope)
  const [logEntries] = useScopeValue('pdf.logEntries', $scope)
  const [uncompiled] = useScopeValue('pdf.uncompiled', $scope)

  const value = {
    pdfUrl,
    pdfDownloadUrl,
    logEntries,
    uncompiled,
  }

  return (
    <>
      <CompileContext.Provider value={value}>
        {children}
      </CompileContext.Provider>
    </>
  )
}

CompileProvider.propTypes = {
  children: PropTypes.any,
  $scope: PropTypes.any.isRequired,
}

export function useCompileContext(propTypes) {
  const data = useContext(CompileContext)
  PropTypes.checkPropTypes(propTypes, data, 'data', 'CompileContext.Provider')
  return data
}
