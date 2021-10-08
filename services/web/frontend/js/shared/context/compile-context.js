import { createContext, useContext, useMemo } from 'react'
import PropTypes from 'prop-types'
import useScopeValue from './util/scope-value-hook'

export const CompileContext = createContext()

CompileContext.Provider.propTypes = {
  value: PropTypes.shape({
    clsiServerId: PropTypes.string,
    logEntries: PropTypes.object,
    logEntryAnnotations: PropTypes.object,
    pdfDownloadUrl: PropTypes.string,
    pdfUrl: PropTypes.string,
    setClsiServerId: PropTypes.func.isRequired,
    setLogEntries: PropTypes.func.isRequired,
    setLogEntryAnnotations: PropTypes.func.isRequired,
    setPdfDownloadUrl: PropTypes.func.isRequired,
    setPdfUrl: PropTypes.func.isRequired,
    setUncompiled: PropTypes.func.isRequired,
    uncompiled: PropTypes.bool,
  }),
}

export function CompileProvider({ children }) {
  // the log entries parsed from the compile output log
  const [logEntries, setLogEntries] = useScopeValue('pdf.logEntries')

  // annotations for display in the editor, built from the log entries
  const [logEntryAnnotations, setLogEntryAnnotations] = useScopeValue(
    'pdf.logEntryAnnotations'
  )

  // the URL for downloading the PDF
  const [pdfDownloadUrl, setPdfDownloadUrl] = useScopeValue('pdf.downloadUrl')

  // the URL for loading the PDF in the preview pane
  const [pdfUrl, setPdfUrl] = useScopeValue('pdf.url')

  // the project is considered to be "uncompiled" if a doc has changed since the last compile started
  const [uncompiled, setUncompiled] = useScopeValue('pdf.uncompiled')

  // the id of the CLSI server which ran the compile
  const [clsiServerId, setClsiServerId] = useScopeValue('pdf.clsiServerId')

  const value = useMemo(
    () => ({
      clsiServerId,
      logEntries,
      logEntryAnnotations,
      pdfDownloadUrl,
      pdfUrl,
      setClsiServerId,
      setLogEntries,
      setLogEntryAnnotations,
      setPdfDownloadUrl,
      setPdfUrl,
      setUncompiled,
      uncompiled,
    }),
    [
      clsiServerId,
      logEntries,
      logEntryAnnotations,
      pdfDownloadUrl,
      pdfUrl,
      setClsiServerId,
      setLogEntries,
      setLogEntryAnnotations,
      setPdfDownloadUrl,
      setPdfUrl,
      setUncompiled,
      uncompiled,
    ]
  )

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
