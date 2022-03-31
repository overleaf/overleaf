import { createContext, useContext, useMemo } from 'react'
import PropTypes from 'prop-types'
import {
  useLocalCompileContext,
  CompileContextPropTypes,
} from './local-compile-context'
import useDetachStateWatcher from '../hooks/use-detach-state-watcher'
import useDetachAction from '../hooks/use-detach-action'

export const DetachCompileContext = createContext()

DetachCompileContext.Provider.propTypes = CompileContextPropTypes

export function DetachCompileProvider({ children }) {
  const localCompileContext = useLocalCompileContext()
  if (!localCompileContext) {
    throw new Error(
      'DetachCompileProvider is only available inside LocalCompileProvider'
    )
  }

  const {
    autoCompile: _autoCompile,
    clearingCache: _clearingCache,
    clsiServerId: _clsiServerId,
    codeCheckFailed: _codeCheckFailed,
    compiling: _compiling,
    draft: _draft,
    error: _error,
    fileList: _fileList,
    hasChanges: _hasChanges,
    highlights: _highlights,
    logEntries: _logEntries,
    logEntryAnnotations: _logEntryAnnotations,
    pdfDownloadUrl: _pdfDownloadUrl,
    pdfUrl: _pdfUrl,
    pdfViewer: _pdfViewer,
    position: _position,
    rawLog: _rawLog,
    setAutoCompile: _setAutoCompile,
    setDraft: _setDraft,
    setError: _setError,
    setHasLintingError: _setHasLintingError,
    setHighlights: _setHighlights,
    setPosition: _setPosition,
    setShowLogs: _setShowLogs,
    toggleLogs: _toggleLogs,
    setStopOnValidationError: _setStopOnValidationError,
    showLogs: _showLogs,
    stopOnValidationError: _stopOnValidationError,
    uncompiled: _uncompiled,
    validationIssues: _validationIssues,
    firstRenderDone: _firstRenderDone,
    cleanupCompileResult: _cleanupCompileResult,
    recompileFromScratch: _recompileFromScratch,
    setCompiling: _setCompiling,
    startCompile: _startCompile,
    stopCompile: _stopCompile,
    setChangedAt: _setChangedAt,
    clearCache: _clearCache,
  } = localCompileContext

  const [autoCompile] = useDetachStateWatcher(
    'autoCompile',
    _autoCompile,
    'detacher',
    'detached'
  )
  const [clearingCache] = useDetachStateWatcher(
    'clearingCache',
    _clearingCache,
    'detacher',
    'detached'
  )
  const [clsiServerId] = useDetachStateWatcher(
    'clsiServerId',
    _clsiServerId,
    'detacher',
    'detached'
  )
  const [codeCheckFailed] = useDetachStateWatcher(
    'codeCheckFailed',
    _codeCheckFailed,
    'detacher',
    'detached'
  )
  const [compiling] = useDetachStateWatcher(
    'compiling',
    _compiling,
    'detacher',
    'detached'
  )
  const [draft] = useDetachStateWatcher('draft', _draft, 'detacher', 'detached')
  const [error] = useDetachStateWatcher('error', _error, 'detacher', 'detached')
  const [fileList] = useDetachStateWatcher(
    'fileList',
    _fileList,
    'detacher',
    'detached'
  )
  const [hasChanges] = useDetachStateWatcher(
    'hasChanges',
    _hasChanges,
    'detacher',
    'detached'
  )
  const [highlights] = useDetachStateWatcher(
    'highlights',
    _highlights,
    'detacher',
    'detached'
  )
  const [logEntries] = useDetachStateWatcher(
    'logEntries',
    _logEntries,
    'detacher',
    'detached'
  )
  const [logEntryAnnotations] = useDetachStateWatcher(
    'logEntryAnnotations',
    _logEntryAnnotations,
    'detacher',
    'detached'
  )
  const [pdfDownloadUrl] = useDetachStateWatcher(
    'pdfDownloadUrl',
    _pdfDownloadUrl,
    'detacher',
    'detached'
  )
  const [pdfUrl] = useDetachStateWatcher(
    'pdfUrl',
    _pdfUrl,
    'detacher',
    'detached'
  )
  const [pdfViewer] = useDetachStateWatcher(
    'pdfViewer',
    _pdfViewer,
    'detacher',
    'detached'
  )
  const [position] = useDetachStateWatcher(
    'position',
    _position,
    'detacher',
    'detached'
  )
  const [rawLog] = useDetachStateWatcher(
    'rawLog',
    _rawLog,
    'detacher',
    'detached'
  )
  const [showLogs] = useDetachStateWatcher(
    'showLogs',
    _showLogs,
    'detacher',
    'detached'
  )
  const [stopOnValidationError] = useDetachStateWatcher(
    'stopOnValidationError',
    _stopOnValidationError,
    'detacher',
    'detached'
  )
  const [uncompiled] = useDetachStateWatcher(
    'uncompiled',
    _uncompiled,
    'detacher',
    'detached'
  )
  const [validationIssues] = useDetachStateWatcher(
    'validationIssues',
    _validationIssues,
    'detacher',
    'detached'
  )

  const setAutoCompile = useDetachAction(
    'setAutoCompile',
    _setAutoCompile,
    'detached',
    'detacher'
  )
  const setDraft = useDetachAction(
    'setDraft',
    _setDraft,
    'detached',
    'detacher'
  )
  const setError = useDetachAction(
    'setError',
    _setError,
    'detacher',
    'detached'
  )
  const setPosition = useDetachAction(
    'setPosition',
    _setPosition,
    'detached',
    'detacher'
  )
  const firstRenderDone = useDetachAction(
    'firstRenderDone',
    _firstRenderDone,
    'detacher',
    'detached'
  )
  const setHasLintingError = useDetachAction(
    'setHasLintingError',
    _setHasLintingError,
    'detacher',
    'detached'
  )
  const setHighlights = useDetachAction(
    'setHighlights',
    _setHighlights,
    'detacher',
    'detached'
  )
  const setShowLogs = useDetachAction(
    'setShowLogs',
    _setShowLogs,
    'detached',
    'detacher'
  )
  const toggleLogs = useDetachAction(
    'toggleLogs',
    _toggleLogs,
    'detached',
    'detacher'
  )
  const setStopOnValidationError = useDetachAction(
    'setStopOnValidationError',
    _setStopOnValidationError,
    'detached',
    'detacher'
  )
  const cleanupCompileResult = useDetachAction(
    'cleanupCompileResult',
    _cleanupCompileResult,
    'detached',
    'detacher'
  )
  const recompileFromScratch = useDetachAction(
    'recompileFromScratch',
    _recompileFromScratch,
    'detached',
    'detacher'
  )
  const setCompiling = useDetachAction(
    'setCompiling',
    _setCompiling,
    'detacher',
    'detached'
  )
  const startCompile = useDetachAction(
    'startCompile',
    _startCompile,
    'detached',
    'detacher'
  )
  const stopCompile = useDetachAction(
    'stopCompile',
    _stopCompile,
    'detached',
    'detacher'
  )
  const setChangedAt = useDetachAction(
    'setChangedAt',
    _setChangedAt,
    'detached',
    'detacher'
  )
  const clearCache = useDetachAction(
    'clearCache',
    _clearCache,
    'detached',
    'detacher'
  )

  const value = useMemo(
    () => ({
      autoCompile,
      clearCache,
      clearingCache,
      clsiServerId,
      codeCheckFailed,
      compiling,
      draft,
      error,
      fileList,
      hasChanges,
      highlights,
      logEntryAnnotations,
      logEntries,
      pdfDownloadUrl,
      pdfUrl,
      pdfViewer,
      position,
      rawLog,
      recompileFromScratch,
      setAutoCompile,
      setCompiling,
      setDraft,
      setError,
      setHasLintingError,
      setHighlights,
      setPosition,
      setShowLogs,
      toggleLogs,
      setStopOnValidationError,
      showLogs,
      startCompile,
      stopCompile,
      stopOnValidationError,
      uncompiled,
      validationIssues,
      firstRenderDone,
      setChangedAt,
      cleanupCompileResult,
    }),
    [
      autoCompile,
      clearCache,
      clearingCache,
      clsiServerId,
      codeCheckFailed,
      compiling,
      draft,
      error,
      fileList,
      hasChanges,
      highlights,
      logEntryAnnotations,
      logEntries,
      pdfDownloadUrl,
      pdfUrl,
      pdfViewer,
      position,
      rawLog,
      recompileFromScratch,
      setAutoCompile,
      setCompiling,
      setDraft,
      setError,
      setHasLintingError,
      setHighlights,
      setPosition,
      setShowLogs,
      toggleLogs,
      setStopOnValidationError,
      showLogs,
      startCompile,
      stopCompile,
      stopOnValidationError,
      uncompiled,
      validationIssues,
      firstRenderDone,
      setChangedAt,
      cleanupCompileResult,
    ]
  )

  return (
    <DetachCompileContext.Provider value={value}>
      {children}
    </DetachCompileContext.Provider>
  )
}

DetachCompileProvider.propTypes = {
  children: PropTypes.any,
}

export function useDetachCompileContext(propTypes) {
  const data = useContext(DetachCompileContext)
  PropTypes.checkPropTypes(
    propTypes,
    data,
    'data',
    'DetachCompileContext.Provider'
  )
  return data
}
