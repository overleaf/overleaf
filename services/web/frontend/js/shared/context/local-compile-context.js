import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import PropTypes from 'prop-types'
import useScopeValue from '../hooks/use-scope-value'
import useScopeValueSetterOnly from '../hooks/use-scope-value-setter-only'
import usePersistedState from '../hooks/use-persisted-state'
import useAbortController from '../hooks/use-abort-controller'
import DocumentCompiler from '../../features/pdf-preview/util/compiler'
import {
  send,
  sendMBOnce,
  sendMBSampled,
} from '../../infrastructure/event-tracking'
import {
  buildLogEntryAnnotations,
  handleLogFiles,
  handleOutputFiles,
} from '../../features/pdf-preview/util/output-files'
import { useIdeContext } from './ide-context'
import { useProjectContext } from './project-context'
import { useEditorContext } from './editor-context'
import { buildFileList } from '../../features/pdf-preview/util/file-list'
import { useLayoutContext } from './layout-context'
import { useUserContext } from './user-context'
import getMeta from '../../utils/meta'

export const LocalCompileContext = createContext()

export const CompileContextPropTypes = {
  value: PropTypes.shape({
    autoCompile: PropTypes.bool.isRequired,
    clearingCache: PropTypes.bool.isRequired,
    clsiServerId: PropTypes.string,
    codeCheckFailed: PropTypes.bool.isRequired,
    compiling: PropTypes.bool.isRequired,
    deliveryLatencies: PropTypes.object.isRequired,
    draft: PropTypes.bool.isRequired,
    error: PropTypes.string,
    fileList: PropTypes.object,
    forceNewDomainVariant: PropTypes.string,
    hasChanges: PropTypes.bool.isRequired,
    highlights: PropTypes.arrayOf(PropTypes.object),
    logEntries: PropTypes.object,
    logEntryAnnotations: PropTypes.object,
    pdfDownloadUrl: PropTypes.string,
    pdfFile: PropTypes.object,
    pdfUrl: PropTypes.string,
    pdfViewer: PropTypes.string,
    position: PropTypes.object,
    rawLog: PropTypes.string,
    setAutoCompile: PropTypes.func.isRequired,
    setDraft: PropTypes.func.isRequired,
    setError: PropTypes.func.isRequired,
    setHasLintingError: PropTypes.func.isRequired, // only for storybook
    setHighlights: PropTypes.func.isRequired,
    setPosition: PropTypes.func.isRequired,
    setShowCompileTimeWarning: PropTypes.func.isRequired,
    setShowLogs: PropTypes.func.isRequired,
    toggleLogs: PropTypes.func.isRequired,
    setStopOnFirstError: PropTypes.func.isRequired,
    setStopOnValidationError: PropTypes.func.isRequired,
    showCompileTimeWarning: PropTypes.bool.isRequired,
    showLogs: PropTypes.bool.isRequired,
    showFasterCompilesFeedbackUI: PropTypes.bool.isRequired,
    stopOnFirstError: PropTypes.bool.isRequired,
    stopOnValidationError: PropTypes.bool.isRequired,
    stoppedOnFirstError: PropTypes.bool.isRequired,
    uncompiled: PropTypes.bool,
    validationIssues: PropTypes.object,
    firstRenderDone: PropTypes.func.isRequired,
    cleanupCompileResult: PropTypes.func,
  }),
}

LocalCompileContext.Provider.propTypes = CompileContextPropTypes

export function LocalCompileProvider({ children }) {
  const ide = useIdeContext()

  const { hasPremiumCompile, isProjectOwner } = useEditorContext()

  const { _id: projectId, rootDocId } = useProjectContext()

  const { pdfPreviewOpen } = useLayoutContext()

  const { features } = useUserContext()

  // whether a compile is in progress
  const [compiling, setCompiling] = useState(false)

  // whether to show the compile time warning
  const [showCompileTimeWarning, setShowCompileTimeWarning] = useState(false)

  // the log entries parsed from the compile output log
  const [logEntries, setLogEntries] = useScopeValueSetterOnly('pdf.logEntries')

  // annotations for display in the editor, built from the log entries
  const [logEntryAnnotations, setLogEntryAnnotations] = useScopeValue(
    'pdf.logEntryAnnotations'
  )

  // the PDF viewer
  const [pdfViewer] = useScopeValue('settings.pdfViewer')

  // the URL for downloading the PDF
  const [, setPdfDownloadUrl] = useScopeValueSetterOnly('pdf.downloadUrl')

  // the URL for loading the PDF in the preview pane
  const [, setPdfUrl] = useScopeValueSetterOnly('pdf.url')

  // low level details for metrics
  const [pdfFile, setPdfFile] = useState()

  useEffect(() => {
    setPdfDownloadUrl(pdfFile?.pdfDownloadUrl)
    setPdfUrl(pdfFile?.pdfUrl)
  }, [pdfFile, setPdfDownloadUrl, setPdfUrl])

  // the project is considered to be "uncompiled" if a doc has changed, or finished saving, since the last compile started.
  const [uncompiled, setUncompiled] = useScopeValue('pdf.uncompiled')

  // whether a doc has been edited since the last compile started
  const [editedSinceCompileStarted, setEditedSinceCompileStarted] =
    useState(false)

  // the id of the CLSI server which ran the compile
  const [clsiServerId, setClsiServerId] = useState()

  // data received in response to a compile request
  const [data, setData] = useState()

  // callback to be invoked for PdfJsMetrics
  const [firstRenderDone, setFirstRenderDone] = useState(() => () => {})

  // latencies of compile/pdf download/rendering
  const [deliveryLatencies, setDeliveryLatencies] = useState({})

  // whether the project has been compiled yet
  const [compiledOnce, setCompiledOnce] = useState(false)

  // whether the cache is being cleared
  const [clearingCache, setClearingCache] = useState(false)

  // whether the logs should be visible
  const [showLogs, setShowLogs] = useState(false)

  // whether the faster compiles feedback UI should be displayed
  const [showFasterCompilesFeedbackUI, setShowFasterCompilesFeedbackUI] =
    useState(false)

  // whether the compile dropdown arrow should be animated
  const [animateCompileDropdownArrow, setAnimateCompileDropdownArrow] =
    useState(false)

  const toggleLogs = useCallback(() => {
    setShowLogs(prev => {
      if (!prev) {
        sendMBOnce('ide-open-logs-once')
      }
      return !prev
    })
  }, [setShowLogs])

  // an error that occurred
  const [error, setError] = useState()

  // the list of files that can be downloaded
  const [fileList, setFileList] = useState()

  // Split test variant for disabling the fallback, refreshed on re-compile.
  const [forceNewDomainVariant, setForceNewDomainVariant] = useState(
    getMeta('ol-splitTestVariants')?.['force-new-compile-domain']
  )

  // the raw contents of the log file
  const [rawLog, setRawLog] = useState()

  // validation issues from CLSI
  const [validationIssues, setValidationIssues] = useState()

  // areas to highlight on the PDF, from synctex
  const [highlights, setHighlights] = useState()

  // scroll position of the PDF
  const [position, setPosition] = usePersistedState(`pdf.position.${projectId}`)

  // whether autocompile is switched on
  const [autoCompile, setAutoCompile] = usePersistedState(
    `autocompile_enabled:${projectId}`,
    false,
    true
  )

  // whether the compile should run in draft mode
  const [draft, setDraft] = usePersistedState(`draft:${projectId}`, false, true)

  // whether compiling should stop on first error
  const [stopOnFirstError, setStopOnFirstError] = usePersistedState(
    `stop_on_first_error:${projectId}`,
    false,
    true
  )

  // whether the last compiles stopped on first error
  const [stoppedOnFirstError, setStoppedOnFirstError] = useState(false)

  // whether compiling should be prevented if there are linting errors
  const [stopOnValidationError, setStopOnValidationError] = usePersistedState(
    `stop_on_validation_error:${projectId}`,
    true,
    true
  )

  // the Document currently open in the editor
  const [currentDoc] = useScopeValue('editor.sharejs_doc')

  // whether the editor linter found errors
  const [hasLintingError, setHasLintingError] = useScopeValue('hasLintingError')

  // whether syntax validation is enabled globally
  const [syntaxValidation] = useScopeValue('settings.syntaxValidation')

  // the timestamp that a doc was last changed
  const [changedAt, setChangedAt] = useState(0)

  // the timestamp that a doc was last saved
  const [savedAt, setSavedAt] = useState(0)

  const { signal } = useAbortController()

  const cleanupCompileResult = useCallback(() => {
    setPdfFile(null)
    setLogEntries(null)
    setLogEntryAnnotations({})
  }, [setPdfFile, setLogEntries, setLogEntryAnnotations])

  const compilingRef = useRef(false)

  useEffect(() => {
    compilingRef.current = compiling
  }, [compiling])

  // the document compiler
  const [compiler] = useState(() => {
    return new DocumentCompiler({
      projectId,
      rootDocId,
      setChangedAt,
      setSavedAt,
      setCompiling,
      setData,
      setFirstRenderDone,
      setDeliveryLatencies,
      setError,
      cleanupCompileResult,
      compilingRef,
      signal,
    })
  })

  // keep currentDoc in sync with the compiler
  useEffect(() => {
    compiler.currentDoc = currentDoc
  }, [compiler, currentDoc])

  // keep draft setting in sync with the compiler
  useEffect(() => {
    compiler.setOption('draft', draft)
  }, [compiler, draft])

  // keep stop on first error setting in sync with the compiler
  useEffect(() => {
    compiler.setOption('stopOnFirstError', stopOnFirstError)
  }, [compiler, stopOnFirstError])

  useEffect(() => {
    setUncompiled(changedAt > 0 || savedAt > 0)
  }, [setUncompiled, changedAt, savedAt])

  useEffect(() => {
    setEditedSinceCompileStarted(changedAt > 0)
  }, [setEditedSinceCompileStarted, changedAt])

  // always compile the PDF once after opening the project, after the doc has loaded
  useEffect(() => {
    if (!compiledOnce && currentDoc) {
      setCompiledOnce(true)
      compiler.compile({ isAutoCompileOnLoad: true })
    }
  }, [compiledOnce, currentDoc, compiler])

  useEffect(() => {
    const compileTimeWarningEnabled = features?.compileTimeout <= 60

    if (compileTimeWarningEnabled && compiling && isProjectOwner) {
      const timeout = window.setTimeout(() => {
        setShowCompileTimeWarning(true)
      }, 30000)

      return () => {
        window.clearTimeout(timeout)
      }
    }
  }, [compiling, isProjectOwner, features])

  // handle the data returned from a compile request
  // note: this should _only_ run when `data` changes,
  // the other dependencies must all be static
  useEffect(() => {
    const abortController = new AbortController()

    if (data) {
      if (data.clsiServerId) {
        setClsiServerId(data.clsiServerId) // set in scope, for PdfSynctexController
      }
      setShowFasterCompilesFeedbackUI(
        Boolean(data.showFasterCompilesFeedbackUI)
      )
      setForceNewDomainVariant(data.forceNewDomainVariant || 'default')

      if (data.outputFiles) {
        const outputFiles = new Map()

        for (const outputFile of data.outputFiles) {
          outputFiles.set(outputFile.path, outputFile)
        }

        // set the PDF context
        if (data.status === 'success') {
          setPdfFile(handleOutputFiles(outputFiles, projectId, data))
        }

        setFileList(
          buildFileList(outputFiles, data.clsiServerId, data.compileGroup)
        )

        // handle log files
        // asynchronous (TODO: cancel on new compile?)
        setLogEntryAnnotations(null)
        setLogEntries(null)
        setRawLog(null)

        handleLogFiles(outputFiles, data, abortController.signal).then(
          result => {
            setRawLog(result.log)
            setLogEntries(result.logEntries)
            setLogEntryAnnotations(
              buildLogEntryAnnotations(
                result.logEntries.all,
                ide.fileTreeManager
              )
            )

            // sample compile stats for real users
            if (
              !window.user.alphaProgram &&
              ['success', 'stopped-on-first-error'].includes(data.status)
            ) {
              sendMBSampled(
                'compile-result',
                {
                  errors: result.logEntries.errors.length,
                  warnings: result.logEntries.warnings.length,
                  typesetting: result.logEntries.typesetting.length,
                  newPdfPreview: true, // TODO: is this useful?
                  stopOnFirstError: data.options.stopOnFirstError,
                },
                0.01
              )
            }
          }
        )
      }

      switch (data.status) {
        case 'success':
          setError(undefined)
          setShowLogs(false)
          break

        case 'stopped-on-first-error':
          setError(undefined)
          setShowLogs(true)
          break

        case 'clsi-maintenance':
        case 'compile-in-progress':
        case 'exited':
        case 'failure':
        case 'project-too-large':
        case 'rate-limited':
        case 'terminated':
        case 'too-recently-compiled':
          setError(data.status)
          break

        case 'timedout':
          setError('timedout')

          if (!hasPremiumCompile && isProjectOwner) {
            send(
              'subscription-funnel',
              'editor-click-feature',
              'compile-timeout'
            )
          }
          break

        case 'autocompile-backoff':
          if (!data.options.isAutoCompileOnLoad) {
            setError('autocompile-disabled')
            setAutoCompile(false)
          }
          break

        case 'unavailable':
          setError('clsi-unavailable')
          break

        case 'validation-problems':
          setError('validation-problems')
          setValidationIssues(data.validationProblems)
          break

        default:
          setError('error')
          break
      }

      setStoppedOnFirstError(data.status === 'stopped-on-first-error')
    }

    return () => {
      abortController.abort()
    }
  }, [
    data,
    ide,
    hasPremiumCompile,
    isProjectOwner,
    projectId,
    setAutoCompile,
    setClsiServerId,
    setLogEntries,
    setLogEntryAnnotations,
    setPdfFile,
  ])

  // switch to logs if there's an error
  useEffect(() => {
    if (error) {
      setShowLogs(true)
    }
  }, [error])

  // whether there has been an autocompile linting error, if syntax validation is switched on
  const autoCompileLintingError = Boolean(
    autoCompile && syntaxValidation && hasLintingError
  )

  const codeCheckFailed = stopOnValidationError && autoCompileLintingError

  // the project is available for auto-compiling
  // (autocompile is enabled, the PDF preview is open, and the code check (if enabled) hasn't failed)
  const canAutoCompile = Boolean(
    autoCompile && pdfPreviewOpen && !codeCheckFailed
  )

  // show that the project has pending changes
  const hasChanges = Boolean(canAutoCompile && uncompiled && compiledOnce)

  // call the debounced autocompile function if the project is available for auto-compiling and it has changed
  useEffect(() => {
    if (canAutoCompile) {
      if (changedAt > 0 || savedAt > 0) {
        compiler.debouncedAutoCompile()
      }
    } else {
      compiler.debouncedAutoCompile.cancel()
    }
  }, [compiler, canAutoCompile, changedAt, savedAt])

  // cancel debounced recompile on unmount
  useEffect(() => {
    return () => {
      compiler.debouncedAutoCompile.cancel()
    }
  }, [compiler])

  // start a compile manually
  const startCompile = useCallback(
    options => {
      compiler.compile(options)
    },
    [compiler]
  )

  // stop a compile manually
  const stopCompile = useCallback(() => {
    compiler.stopCompile()
  }, [compiler])

  // clear the compile cache
  const clearCache = useCallback(() => {
    setClearingCache(true)

    return compiler
      .clearCache()
      .then(() => {
        setFileList(undefined)
        setPdfFile(undefined)
      })
      .finally(() => {
        setClearingCache(false)
      })
  }, [compiler])

  const syncToEntry = useCallback(
    entry => {
      const entity = ide.fileTreeManager.findEntityByPath(entry.file)

      if (entity && entity.type === 'doc') {
        ide.editorManager.openDoc(entity, {
          gotoLine: entry.line ?? undefined,
          gotoColumn: entry.column ?? undefined,
        })
      }
    },
    [ide]
  )

  // clear the cache then run a compile, triggered by a menu item
  const recompileFromScratch = useCallback(() => {
    clearCache().then(() => {
      compiler.compile()
    })
  }, [clearCache, compiler])

  // After a compile, the compiler sets `data.options` to the options that were
  // used for that compile.
  const lastCompileOptions = useMemo(() => data?.options || {}, [data])

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
      forceNewDomainVariant,
      hasChanges,
      highlights,
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
      setHasLintingError, // only for stories
      setHighlights,
      setPosition,
      showCompileTimeWarning,
      setShowCompileTimeWarning,
      setShowLogs,
      toggleLogs,
      setStopOnFirstError,
      setStopOnValidationError,
      showLogs,
      showFasterCompilesFeedbackUI,
      startCompile,
      stopCompile,
      stopOnFirstError,
      stopOnValidationError,
      stoppedOnFirstError,
      uncompiled,
      validationIssues,
      firstRenderDone,
      setChangedAt,
      setSavedAt,
      cleanupCompileResult,
      syncToEntry,
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
      forceNewDomainVariant,
      hasChanges,
      highlights,
      lastCompileOptions,
      logEntries,
      logEntryAnnotations,
      position,
      pdfFile,
      pdfViewer,
      rawLog,
      recompileFromScratch,
      setAnimateCompileDropdownArrow,
      setAutoCompile,
      setDraft,
      setError,
      setHasLintingError, // only for stories
      setHighlights,
      setPosition,
      setShowCompileTimeWarning,
      setStopOnFirstError,
      setStopOnValidationError,
      showCompileTimeWarning,
      showLogs,
      showFasterCompilesFeedbackUI,
      startCompile,
      stopCompile,
      stopOnFirstError,
      stopOnValidationError,
      stoppedOnFirstError,
      uncompiled,
      validationIssues,
      firstRenderDone,
      setChangedAt,
      setSavedAt,
      cleanupCompileResult,
      setShowLogs,
      toggleLogs,
      syncToEntry,
    ]
  )

  return (
    <LocalCompileContext.Provider value={value}>
      {children}
    </LocalCompileContext.Provider>
  )
}

LocalCompileProvider.propTypes = {
  children: PropTypes.any,
}

export function useLocalCompileContext(propTypes) {
  const data = useContext(LocalCompileContext)
  PropTypes.checkPropTypes(
    propTypes,
    data,
    'data',
    'LocalCompileContext.Provider'
  )
  return data
}
