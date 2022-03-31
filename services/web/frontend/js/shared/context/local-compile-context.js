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

export const LocalCompileContext = createContext()

export const CompileContextPropTypes = {
  value: PropTypes.shape({
    autoCompile: PropTypes.bool.isRequired,
    clearingCache: PropTypes.bool.isRequired,
    clsiServerId: PropTypes.string,
    codeCheckFailed: PropTypes.bool.isRequired,
    compiling: PropTypes.bool.isRequired,
    draft: PropTypes.bool.isRequired,
    error: PropTypes.string,
    fileList: PropTypes.object,
    hasChanges: PropTypes.bool.isRequired,
    highlights: PropTypes.arrayOf(PropTypes.object),
    logEntries: PropTypes.object,
    logEntryAnnotations: PropTypes.object,
    pdfDownloadUrl: PropTypes.string,
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
    setShowLogs: PropTypes.func.isRequired,
    toggleLogs: PropTypes.func.isRequired,
    setStopOnValidationError: PropTypes.func.isRequired,
    showLogs: PropTypes.bool.isRequired,
    stopOnValidationError: PropTypes.bool.isRequired,
    uncompiled: PropTypes.bool,
    validationIssues: PropTypes.object,
    firstRenderDone: PropTypes.func,
    cleanupCompileResult: PropTypes.func,
  }),
}

LocalCompileContext.Provider.propTypes = CompileContextPropTypes

export function LocalCompileProvider({ children }) {
  const ide = useIdeContext()

  const { hasPremiumCompile, isProjectOwner } = useEditorContext()

  const { _id: projectId, rootDocId } = useProjectContext()

  // whether a compile is in progress
  const [compiling, setCompiling] = useState(false)

  // the log entries parsed from the compile output log
  const [logEntries, setLogEntries] = useScopeValueSetterOnly('pdf.logEntries')

  // annotations for display in the editor, built from the log entries
  const [logEntryAnnotations, setLogEntryAnnotations] = useScopeValue(
    'pdf.logEntryAnnotations'
  )

  // the PDF viewer
  const [pdfViewer] = useScopeValue('settings.pdfViewer')

  // the URL for downloading the PDF
  const [pdfDownloadUrl, setPdfDownloadUrl] =
    useScopeValueSetterOnly('pdf.downloadUrl')

  // the URL for loading the PDF in the preview pane
  const [pdfUrl, setPdfUrl] = useScopeValueSetterOnly('pdf.url')

  // the project is considered to be "uncompiled" if a doc has changed since the last compile started
  const [uncompiled, setUncompiled] = useScopeValue('pdf.uncompiled')

  // the id of the CLSI server which ran the compile
  const [clsiServerId, setClsiServerId] = useState()

  // data received in response to a compile request
  const [data, setData] = useState()

  // callback to be invoked for PdfJsMetrics
  const [firstRenderDone, setFirstRenderDone] = useState()

  // whether the project has been compiled yet
  const [compiledOnce, setCompiledOnce] = useState(false)

  // whether the cache is being cleared
  const [clearingCache, setClearingCache] = useState(false)

  // whether the logs should be visible
  const [showLogs, setShowLogs] = useState(false)

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

  // the timestamp that a doc was last changed or saved
  const [changedAt, setChangedAt] = useState(0)

  const { signal } = useAbortController()

  const cleanupCompileResult = useCallback(() => {
    setPdfUrl(null)
    setPdfDownloadUrl(null)
    setLogEntries(null)
    setLogEntryAnnotations({})
  }, [setPdfUrl, setPdfDownloadUrl, setLogEntries, setLogEntryAnnotations])

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
      setCompiling,
      setData,
      setFirstRenderDone,
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
    compiler.draft = draft
  }, [compiler, draft])

  // pass the "uncompiled" value up into the scope for use outside this context provider
  useEffect(() => {
    setUncompiled(changedAt > 0)
  }, [setUncompiled, changedAt])

  // always compile the PDF once after opening the project, after the doc has loaded
  useEffect(() => {
    if (!compiledOnce && currentDoc) {
      setCompiledOnce(true)
      compiler.compile({ isAutoCompileOnLoad: true })
    }
  }, [compiledOnce, currentDoc, compiler])

  // handle the data returned from a compile request
  // note: this should _only_ run when `data` changes,
  // the other dependencies must all be static
  useEffect(() => {
    const abortController = new AbortController()

    if (data) {
      if (data.clsiServerId) {
        setClsiServerId(data.clsiServerId) // set in scope, for PdfSynctexController
      }

      if (data.outputFiles) {
        const outputFiles = new Map()

        for (const outputFile of data.outputFiles) {
          outputFiles.set(outputFile.path, outputFile)
        }

        // set the PDF URLs
        handleOutputFiles(outputFiles, projectId, data).then(result => {
          if (data.status === 'success') {
            setPdfDownloadUrl(result.pdfDownloadUrl)
            setPdfUrl(result.pdfUrl)
          }

          setFileList(buildFileList(outputFiles, data.clsiServerId))

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
              if (!window.user.alphaProgram && data.status === 'success') {
                sendMBSampled(
                  'compile-result',
                  {
                    errors: result.logEntries.errors.length,
                    warnings: result.logEntries.warnings.length,
                    typesetting: result.logEntries.typesetting.length,
                    newPdfPreview: true, // TODO: is this useful?
                  },
                  0.01
                )
              }
            }
          )
        })
      }

      switch (data.status) {
        case 'success':
          setError(undefined)
          setShowLogs(false)
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
    setPdfDownloadUrl,
    setPdfUrl,
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
  const canAutoCompile = Boolean(autoCompile && !codeCheckFailed)

  // show that the project has pending changes
  const hasChanges = Boolean(canAutoCompile && uncompiled && compiledOnce)

  // call the debounced autocompile function if the project is available for auto-compiling and it has changed
  useEffect(() => {
    if (canAutoCompile) {
      if (changedAt > 0) {
        compiler.debouncedAutoCompile()
      }
    } else {
      compiler.debouncedAutoCompile.cancel()
    }
  }, [compiler, canAutoCompile, changedAt])

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
        setPdfDownloadUrl(undefined)
        setPdfUrl(undefined)
      })
      .finally(() => {
        setClearingCache(false)
      })
  }, [compiler, setPdfDownloadUrl, setPdfUrl])

  // clear the cache then run a compile, triggered by a menu item
  const recompileFromScratch = useCallback(() => {
    clearCache().then(() => {
      compiler.compile()
    })
  }, [clearCache, compiler])

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
      setHasLintingError, // only for stories
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
      logEntries,
      logEntryAnnotations,
      position,
      pdfDownloadUrl,
      pdfUrl,
      pdfViewer,
      rawLog,
      recompileFromScratch,
      setAutoCompile,
      setDraft,
      setError,
      setHasLintingError, // only for stories
      setHighlights,
      setPosition,
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
      setShowLogs,
      toggleLogs,
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
