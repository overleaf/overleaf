import { createContext, FC, useContext, useMemo } from 'react'
import { CompileContext, useLocalCompileContext } from './local-compile-context'
import useDetachStateWatcher from '../hooks/use-detach-state-watcher'
import useDetachAction from '../hooks/use-detach-action'
import useCompileTriggers from '../../features/pdf-preview/hooks/use-compile-triggers'
import { useLogEvents } from '@/features/pdf-preview/hooks/use-log-events'

export const DetachCompileContext = createContext<CompileContext | undefined>(
  undefined
)

export const DetachCompileProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const localCompileContext = useLocalCompileContext()
  if (!localCompileContext) {
    throw new Error(
      'DetachCompileProvider is only available inside LocalCompileProvider'
    )
  }

  const {
    animateCompileDropdownArrow: _animateCompileDropdownArrow,
    autoCompile: _autoCompile,
    clearingCache: _clearingCache,
    clsiServerId: _clsiServerId,
    codeCheckFailed: _codeCheckFailed,
    compiling: _compiling,
    deliveryLatencies: _deliveryLatencies,
    draft: _draft,
    editedSinceCompileStarted: _editedSinceCompileStarted,
    error: _error,
    fileList: _fileList,
    hasChanges: _hasChanges,
    hasShortCompileTimeout: _hasShortCompileTimeout,
    highlights: _highlights,
    isProjectOwner: _isProjectOwner,
    lastCompileOptions: _lastCompileOptions,
    logEntries: _logEntries,
    logEntryAnnotations: _logEntryAnnotations,
    pdfFile: _pdfFile,
    pdfViewer: _pdfViewer,
    position: _position,
    rawLog: _rawLog,
    setAnimateCompileDropdownArrow: _setAnimateCompileDropdownArrow,
    setAutoCompile: _setAutoCompile,
    setDraft: _setDraft,
    setError: _setError,
    setHasLintingError: _setHasLintingError,
    setHighlights: _setHighlights,
    setPosition: _setPosition,
    setShowCompileTimeWarning: _setShowCompileTimeWarning,
    setShowLogs: _setShowLogs,
    toggleLogs: _toggleLogs,
    setStopOnFirstError: _setStopOnFirstError,
    setStopOnValidationError: _setStopOnValidationError,
    showLogs: _showLogs,
    showCompileTimeWarning: _showCompileTimeWarning,
    stopOnFirstError: _stopOnFirstError,
    stopOnValidationError: _stopOnValidationError,
    stoppedOnFirstError: _stoppedOnFirstError,
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
    syncToEntry: _syncToEntry,
    recordAction: _recordAction,
    darkModePdf: _darkModePdf,
    setDarkModePdf: _setDarkModePdf,
    activeOverallTheme: _activeOverallTheme,
  } = localCompileContext

  const [animateCompileDropdownArrow] = useDetachStateWatcher(
    'animateCompileDropdownArrow',
    _animateCompileDropdownArrow,
    'detacher',
    'detached'
  )
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
  const [deliveryLatencies] = useDetachStateWatcher(
    'deliveryLatencies',
    _deliveryLatencies,
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
  const [hasShortCompileTimeout] = useDetachStateWatcher(
    'hasShortCompileTimeout',
    _hasShortCompileTimeout,
    'detacher',
    'detached'
  )
  const [highlights] = useDetachStateWatcher(
    'highlights',
    _highlights,
    'detacher',
    'detached'
  )
  const [isProjectOwner] = useDetachStateWatcher(
    'isProjectOwner',
    _isProjectOwner,
    'detacher',
    'detached'
  )
  const [lastCompileOptions] = useDetachStateWatcher(
    'lastCompileOptions',
    _lastCompileOptions,
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
  const [pdfFile] = useDetachStateWatcher(
    'pdfFile',
    _pdfFile,
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
  const [showCompileTimeWarning] = useDetachStateWatcher(
    'showCompileTimeWarning',
    _showCompileTimeWarning,
    'detacher',
    'detached'
  )
  const [showLogs] = useDetachStateWatcher(
    'showLogs',
    _showLogs,
    'detacher',
    'detached'
  )
  const [stopOnFirstError] = useDetachStateWatcher(
    'stopOnFirstError',
    _stopOnFirstError,
    'detacher',
    'detached'
  )
  const [stopOnValidationError] = useDetachStateWatcher(
    'stopOnValidationError',
    _stopOnValidationError,
    'detacher',
    'detached'
  )
  const [stoppedOnFirstError] = useDetachStateWatcher(
    'stoppedOnFirstError',
    _stoppedOnFirstError,
    'detacher',
    'detached'
  )
  const [uncompiled] = useDetachStateWatcher(
    'uncompiled',
    _uncompiled,
    'detacher',
    'detached'
  )
  const [editedSinceCompileStarted] = useDetachStateWatcher(
    'editedSinceCompileStarted',
    _editedSinceCompileStarted,
    'detacher',
    'detached'
  )
  const [validationIssues] = useDetachStateWatcher(
    'validationIssues',
    _validationIssues,
    'detacher',
    'detached'
  )

  const setAnimateCompileDropdownArrow = useDetachAction(
    'setAnimateCompileDropdownArrow',
    _setAnimateCompileDropdownArrow,
    'detached',
    'detacher'
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
    'detached',
    'detacher'
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
  const setShowCompileTimeWarning = useDetachAction(
    'setShowCompileTimeWarning',
    _setShowCompileTimeWarning,
    'detached',
    'detacher'
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
  const setStopOnFirstError = useDetachAction(
    'setStopOnFirstError',
    _setStopOnFirstError,
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

  const syncToEntry = useDetachAction(
    'sync-to-entry',
    _syncToEntry,
    'detached',
    'detacher'
  )

  const recordAction = useDetachAction(
    'record-action',
    _recordAction,
    'detached',
    'detacher'
  )

  const [darkModePdf] = useDetachStateWatcher(
    'darkModePdf',
    _darkModePdf,
    'detacher',
    'detached'
  )
  const setDarkModePdf = useDetachAction(
    'setDarkModePdf',
    _setDarkModePdf,
    'detached',
    'detacher'
  )

  const [activeOverallTheme] = useDetachStateWatcher(
    'activeOverallTheme',
    _activeOverallTheme,
    'detacher',
    'detached'
  )

  useCompileTriggers(startCompile, setChangedAt)
  useLogEvents(setShowLogs)

  const value = useMemo(
    () => ({
      animateCompileDropdownArrow,
      autoCompile,
      clearCache,
      clearingCache,
      clsiServerId,
      codeCheckFailed,
      compiling,
      deliveryLatencies,
      draft,
      editedSinceCompileStarted,
      error,
      fileList,
      hasChanges,
      hasShortCompileTimeout,
      highlights,
      isProjectOwner,
      lastCompileOptions,
      logEntryAnnotations,
      logEntries,
      pdfDownloadUrl: pdfFile?.pdfDownloadUrl,
      pdfFile,
      pdfUrl: pdfFile?.pdfUrl,
      pdfViewer,
      position,
      rawLog,
      recompileFromScratch,
      setAnimateCompileDropdownArrow,
      setAutoCompile,
      setCompiling,
      setDraft,
      setError,
      setHasLintingError,
      setHighlights,
      setPosition,
      setShowCompileTimeWarning,
      setShowLogs,
      toggleLogs,
      setStopOnFirstError,
      setStopOnValidationError,
      showLogs,
      showCompileTimeWarning,
      startCompile,
      stopCompile,
      stopOnFirstError,
      stopOnValidationError,
      stoppedOnFirstError,
      uncompiled,
      validationIssues,
      firstRenderDone,
      setChangedAt,
      cleanupCompileResult,
      syncToEntry,
      recordAction,
      darkModePdf,
      setDarkModePdf,
      activeOverallTheme,
    }),
    [
      animateCompileDropdownArrow,
      autoCompile,
      clearCache,
      clearingCache,
      clsiServerId,
      codeCheckFailed,
      compiling,
      deliveryLatencies,
      draft,
      editedSinceCompileStarted,
      error,
      fileList,
      hasChanges,
      hasShortCompileTimeout,
      highlights,
      isProjectOwner,
      lastCompileOptions,
      logEntryAnnotations,
      logEntries,
      pdfFile,
      pdfViewer,
      position,
      rawLog,
      recompileFromScratch,
      setAnimateCompileDropdownArrow,
      setAutoCompile,
      setCompiling,
      setDraft,
      setError,
      setHasLintingError,
      setHighlights,
      setPosition,
      setShowCompileTimeWarning,
      setShowLogs,
      toggleLogs,
      setStopOnFirstError,
      setStopOnValidationError,
      showCompileTimeWarning,
      showLogs,
      startCompile,
      stopCompile,
      stopOnFirstError,
      stopOnValidationError,
      stoppedOnFirstError,
      uncompiled,
      validationIssues,
      firstRenderDone,
      setChangedAt,
      cleanupCompileResult,
      syncToEntry,
      recordAction,
      darkModePdf,
      setDarkModePdf,
      activeOverallTheme,
    ]
  )

  return (
    <DetachCompileContext.Provider value={value}>
      {children}
    </DetachCompileContext.Provider>
  )
}

export function useDetachCompileContext() {
  const context = useContext(DetachCompileContext)
  if (!context) {
    throw new Error(
      'useDetachCompileContext is ony available inside DetachCompileProvider'
    )
  }
  return context
}
