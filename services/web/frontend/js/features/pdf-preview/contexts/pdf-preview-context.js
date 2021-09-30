import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import PropTypes from 'prop-types'
import useScopeValue from '../../../shared/context/util/scope-value-hook'
import { useProjectContext } from '../../../shared/context/project-context'
import getMeta from '../../../utils/meta'
import { deleteJSON, postJSON } from '../../../infrastructure/fetch-json'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import {
  buildLogEntryAnnotations,
  handleOutputFiles,
} from '../util/output-files'
import { debounce } from 'lodash'
import { useIdeContext } from '../../../shared/context/ide-context'
import {
  send,
  sendMB,
  sendMBSampled,
} from '../../../infrastructure/event-tracking'
import { useEditorContext } from '../../../shared/context/editor-context'
import { isMainFile } from '../util/editor-files'
import useAbortController from '../../../shared/hooks/use-abort-controller'

const AUTO_COMPILE_MAX_WAIT = 5000
// We add a 1 second debounce to sending user changes to server if they aren't
// collaborating with anyone. This needs to be higher than that, and allow for
// client to server latency, otherwise we compile before the op reaches the server
// and then again on ack.
const AUTO_COMPILE_DEBOUNCE = 2000

const searchParams = new URLSearchParams(window.location.search)

export const PdfPreviewContext = createContext(undefined)

PdfPreviewProvider.propTypes = {
  children: PropTypes.any,
}

export default function PdfPreviewProvider({ children }) {
  const ide = useIdeContext()

  const { _id: projectId, rootDoc_id: rootDocId } = useProjectContext()

  const { hasPremiumCompile, isProjectOwner } = useEditorContext()

  // the URL for loading the PDF in the preview pane
  const [pdfUrl, setPdfUrl] = useScopeValue('pdf.url')

  // the URL for downloading the PDF
  const [pdfDownloadUrl, setPdfDownloadUrl] = useScopeValue('pdf.downloadUrl')

  // the log entries parsed from the compile output log
  const [logEntries, setLogEntries] = useScopeValue('pdf.logEntries')

  // the project is considered to be "uncompiled" if a doc has changed since the last compile started
  const [uncompiled, setUncompiled] = useScopeValue('pdf.uncompiled')

  // annotations for display in the editor, built from the log entries
  const [, setLogEntryAnnotations] = useScopeValue('pdf.logEntryAnnotations')

  // the id of the CLSI server which ran the compile
  const [clsiServerId, setClsiServerId] = useScopeValue('ide.clsiServerId')

  // the compile group (standard or priority)
  const [compileGroup, setCompileGroup] = useScopeValue('ide.compileGroup')

  // whether to display the editor and preview side-by-side or full-width ("flat")
  const [pdfLayout, setPdfLayout] = useScopeValue('ui.pdfLayout')

  // what to show in the "flat" view (editor or pdf)
  const [, setUiView] = useScopeValue('ui.view')

  // whether a compile is in progress
  const [compiling, setCompiling] = useState(false)

  // whether the project has been compiled yet
  const [compiledOnce, setCompiledOnce] = useState(false)

  // whether the cache is being cleared
  const [clearingCache, setClearingCache] = useState(false)

  // whether the logs should be visible
  const [showLogs, setShowLogs] = useState(false)

  // an error that occurred
  const [error, setError] = useState()

  // the list of files that can be downloaded
  const [fileList, setFileList] = useState()

  // the raw contents of the log file
  const [rawLog, setRawLog] = useState()

  // validation issues from CLSI
  const [validationIssues, setValidationIssues] = useState()

  // whether autocompile is switched on
  const [autoCompile, _setAutoCompile] = usePersistedState(
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

  // the id of the currently open document in the editor
  const [currentDocId] = useScopeValue('editor.open_doc_id')

  // the Document currently open in the editor?
  const [currentDoc] = useScopeValue('editor.sharejs_doc')

  // whether the PDF view is hidden
  const [pdfHidden] = useScopeValue('ui.pdfHidden')

  // whether the editor linter found errors
  const [hasLintingError, setHasLintingError] = useScopeValue('hasLintingError')

  // whether syntax validation is enabled globally
  const [syntaxValidation] = useScopeValue('settings.syntaxValidation')

  // the timestamp that a doc was last changed or saved
  const [changedAt, setChangedAt] = useState(0)

  const { signal } = useAbortController()

  // pass the "uncompiled" value up into the scope for use outside this context provider
  useEffect(() => {
    setUncompiled(changedAt > 0)
  }, [setUncompiled, changedAt])

  // record changes to the autocompile setting
  const setAutoCompile = useCallback(
    value => {
      _setAutoCompile(value)
      sendMB('autocompile-setting-changed', { value })
    },
    [_setAutoCompile]
  )

  // parse the text of the current doc in the editor
  // if it contains "\documentclass" then use this as the root doc
  const getRootDocOverrideId = useCallback(() => {
    if (currentDocId === rootDocId) {
      return null // no need to override when in the root doc itself
    }

    if (currentDoc) {
      const doc = currentDoc.getSnapshot()

      if (doc) {
        return isMainFile(doc)
      }
    }

    return null
  }, [currentDoc, currentDocId, rootDocId])

  // TODO: remove this?
  const sendCompileMetrics = useCallback(() => {
    if (compiledOnce && !error && !window.user.alphaProgram) {
      const metadata = {
        errors: logEntries.errors.length,
        warnings: logEntries.warnings.length,
        typesetting: logEntries.typesetting.length,
        newPdfPreview: true,
      }
      sendMBSampled('compile-result', metadata, 0.01)
    }
  }, [compiledOnce, error, logEntries])

  // handle the data returned from a compile request
  const handleCompileData = useCallback(
    (data, options) => {
      if (data.clsiServerId) {
        setClsiServerId(data.clsiServerId)
      }

      if (data.compileGroup) {
        setCompileGroup(data.compileGroup)
      }

      if (data.outputFiles) {
        handleOutputFiles(projectId, data).then(result => {
          setLogEntryAnnotations(
            buildLogEntryAnnotations(result.logEntries.all, ide.fileTreeManager)
          )
          setLogEntries(result.logEntries)
          setFileList(result.fileList)
          setPdfDownloadUrl(result.pdfDownloadUrl)
          setPdfUrl(result.pdfUrl)
          setRawLog(result.log)
        })
      }

      switch (data.status) {
        case 'success':
          setError(undefined)
          setShowLogs(false) // TODO: always?
          break

        case 'clsi-maintenance':
        case 'compile-in-progress':
        case 'exited':
        case 'failure':
        case 'project-too-large':
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
            sendMB('paywall-prompt', {
              'paywall-type': 'compile-timeout',
            })
          }
          break

        case 'autocompile-backoff':
          if (!options.isAutoCompileOnLoad) {
            setError('autocompile-disabled')
            setAutoCompile(false)
            sendMB('autocompile-rate-limited', { hasPremiumCompile })
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
    },
    [
      hasPremiumCompile,
      ide.fileTreeManager,
      isProjectOwner,
      projectId,
      setAutoCompile,
      setClsiServerId,
      setCompileGroup,
      setLogEntries,
      setLogEntryAnnotations,
      setPdfDownloadUrl,
      setPdfUrl,
    ]
  )

  const buildCompileParams = useCallback(
    options => {
      const params = new URLSearchParams()

      if (clsiServerId) {
        params.set('clsiserverid', clsiServerId)
      }

      if (options.isAutoCompileOnLoad || options.isAutoCompileOnChange) {
        params.set('auto_compile', 'true')
      }

      if (getMeta('ol-enablePdfCaching')) {
        params.set('enable_pdf_caching', 'true')
      }

      if (searchParams.get('file_line_errors') === 'true') {
        params.file_line_errors = 'true'
      }

      return params
    },
    [clsiServerId]
  )

  // run a compile
  const recompile = useCallback(
    (options = {}) => {
      if (compiling) {
        return
      }

      sendMBSampled('editor-recompile-sampled', options)

      setChangedAt(0) // NOTE: this sets uncompiled to false
      setCompiling(true)
      setValidationIssues(undefined)

      window.dispatchEvent(new CustomEvent('flush-changes')) // TODO: wait for this?

      postJSON(`/project/${projectId}/compile?${buildCompileParams(options)}`, {
        body: {
          rootDoc_id: getRootDocOverrideId(),
          draft,
          check: 'silent', // NOTE: 'error' and 'validate' are possible, but unused
          // use incremental compile for all users but revert to a full compile
          // if there was previously a server error
          incrementalCompilesEnabled: !error,
        },
        signal,
      })
        .then(data => {
          handleCompileData(data, options)
        })
        .catch(error => {
          // console.error(error)
          setError(error.info?.statusCode === 429 ? 'rate-limited' : 'error')
        })
        .finally(() => {
          setCompiling(false)
          sendCompileMetrics()
        })
    },
    [
      compiling,
      projectId,
      buildCompileParams,
      getRootDocOverrideId,
      draft,
      error,
      handleCompileData,
      sendCompileMetrics,
      signal,
    ]
  )

  // switch to logs if there's an error
  useEffect(() => {
    if (error) {
      setShowLogs(true)
    }
  }, [error])

  // recompile on key press
  useEffect(() => {
    const listener = event => {
      recompile(event.detail)
    }

    window.addEventListener('pdf:recompile', listener)

    return () => {
      window.removeEventListener('pdf:recompile', listener)
    }
  }, [recompile])

  // always compile the PDF once, when joining the project
  useEffect(() => {
    const listener = () => {
      if (!compiledOnce) {
        setCompiledOnce(true)
        recompile({ isAutoCompileOnLoad: true })
      }
    }

    window.addEventListener('project:joined', listener)

    return () => {
      window.removeEventListener('project:joined', listener)
    }
  }, [compiledOnce, recompile])

  // whether there has been an autocompile linting error, if syntax validation is switched on
  const autoCompileLintingError = Boolean(
    autoCompile && syntaxValidation && hasLintingError
  )

  // the project has visible changes
  const hasChanges = Boolean(
    autoCompile &&
      uncompiled &&
      compiledOnce &&
      !(stopOnValidationError && autoCompileLintingError)
  )

  // the project is available for auto-compiling
  const canAutoCompile = Boolean(
    autoCompile &&
      !compiling &&
      !pdfHidden &&
      !(stopOnValidationError && autoCompileLintingError)
  )

  // a debounced wrapper around the recompile function, used for auto-compile
  const [debouncedAutoCompile] = useState(() => {
    return debounce(
      () => {
        recompile({ isAutoCompileOnChange: true })
      },
      AUTO_COMPILE_DEBOUNCE,
      {
        maxWait: AUTO_COMPILE_MAX_WAIT,
      }
    )
  })

  // call the debounced recompile function if the project is available for auto-compiling and it has changed
  useEffect(() => {
    if (canAutoCompile && changedAt > 0) {
      debouncedAutoCompile()
    } else {
      debouncedAutoCompile.cancel()
    }
  }, [canAutoCompile, debouncedAutoCompile, recompile, changedAt])

  // cancel debounced recompile on unmount
  useEffect(() => {
    return () => {
      debouncedAutoCompile.cancel()
    }
  }, [debouncedAutoCompile])

  // record doc changes when notified by the editor
  useEffect(() => {
    const listener = () => {
      setChangedAt(Date.now())
    }

    window.addEventListener('doc:changed', listener)
    window.addEventListener('doc:saved', listener)

    return () => {
      window.removeEventListener('doc:changed', listener)
      window.removeEventListener('doc:saved', listener)
    }
  }, [])

  // send a request to stop the current compile
  const stopCompile = useCallback(() => {
    // TODO: stoppingCompile state?

    const params = new URLSearchParams()

    if (clsiServerId) {
      params.set('clsiserverid', clsiServerId)
    }

    return postJSON(`/project/${projectId}/compile/stop?${params}`, { signal })
      .catch(error => {
        setError(error)
      })
      .finally(() => {
        setCompiling(false)
      })
  }, [projectId, clsiServerId, signal])

  const clearCache = useCallback(() => {
    setClearingCache(true)

    const params = new URLSearchParams()

    if (clsiServerId) {
      params.set('clsiserverid', clsiServerId)
    }

    return deleteJSON(`/project/${projectId}/output?${params}`, { signal })
      .catch(error => {
        console.error(error)
        setError('clear-cache')
      })
      .finally(() => {
        setClearingCache(false)
      })
  }, [clsiServerId, projectId, setError, signal])

  // clear the cache then run a compile, triggered by a menu item
  const recompileFromScratch = useCallback(() => {
    setClearingCache(true)
    clearCache().then(() => {
      setClearingCache(false)
      recompile()
    })
  }, [clearCache, recompile])

  // switch to either side-by-side or flat (full-width) layout
  const switchLayout = useCallback(() => {
    setPdfLayout(layout => {
      const newLayout = layout === 'sideBySide' ? 'flat' : 'sideBySide'
      setUiView(newLayout === 'sideBySide' ? 'editor' : 'pdf')
      setPdfLayout(newLayout)
      window.localStorage.setItem('pdf.layout', newLayout)
    })
  }, [setPdfLayout, setUiView])

  // the context value, memoized to minimize re-rendering
  const value = useMemo(() => {
    return {
      autoCompile,
      autoCompileLintingError,
      clearCache,
      clearingCache,
      clsiServerId,
      compileGroup,
      compiledOnce,
      compiling,
      draft,
      error,
      fileList,
      hasChanges,
      hasLintingError,
      logEntries,
      pdfDownloadUrl,
      pdfLayout,
      pdfUrl,
      rawLog,
      recompile,
      recompileFromScratch,
      setAutoCompile,
      setClsiServerId,
      setCompileGroup,
      setCompiledOnce,
      setDraft,
      setError,
      setHasLintingError, // for story
      setLogEntries,
      setPdfDownloadUrl,
      setPdfLayout,
      setPdfUrl,
      setShowLogs,
      setStopOnValidationError,
      setUiView,
      showLogs,
      stopCompile,
      stopOnValidationError,
      switchLayout,
      uncompiled,
      validationIssues,
    }
  }, [
    autoCompile,
    autoCompileLintingError,
    clearCache,
    clearingCache,
    clsiServerId,
    compileGroup,
    compiledOnce,
    compiling,
    draft,
    error,
    fileList,
    hasChanges,
    hasLintingError,
    logEntries,
    pdfDownloadUrl,
    pdfLayout,
    pdfUrl,
    rawLog,
    recompile,
    recompileFromScratch,
    setAutoCompile,
    setClsiServerId,
    setCompileGroup,
    setCompiledOnce,
    setDraft,
    setError,
    setHasLintingError,
    setLogEntries,
    setPdfDownloadUrl,
    setPdfLayout,
    setPdfUrl,
    setStopOnValidationError,
    setUiView,
    showLogs,
    stopCompile,
    stopOnValidationError,
    switchLayout,
    uncompiled,
    validationIssues,
  ])

  return (
    <PdfPreviewContext.Provider value={value}>
      {children}
    </PdfPreviewContext.Provider>
  )
}

PdfPreviewContext.Provider.propTypes = {
  value: PropTypes.shape({
    autoCompile: PropTypes.bool.isRequired,
    autoCompileLintingError: PropTypes.bool.isRequired,
    clearCache: PropTypes.func.isRequired,
    clearingCache: PropTypes.bool.isRequired,
    clsiServerId: PropTypes.string,
    compileGroup: PropTypes.string,
    compiledOnce: PropTypes.bool.isRequired,
    compiling: PropTypes.bool.isRequired,
    draft: PropTypes.bool.isRequired,
    error: PropTypes.string,
    fileList: PropTypes.object,
    hasChanges: PropTypes.bool.isRequired,
    hasLintingError: PropTypes.bool,
    logEntries: PropTypes.object,
    pdfDownloadUrl: PropTypes.string,
    pdfLayout: PropTypes.string,
    pdfUrl: PropTypes.string,
    rawLog: PropTypes.string,
    recompile: PropTypes.func.isRequired,
    recompileFromScratch: PropTypes.func.isRequired,
    setAutoCompile: PropTypes.func.isRequired,
    setClsiServerId: PropTypes.func.isRequired,
    setCompileGroup: PropTypes.func.isRequired,
    setCompiledOnce: PropTypes.func.isRequired,
    setDraft: PropTypes.func.isRequired,
    setError: PropTypes.func.isRequired,
    setHasLintingError: PropTypes.func.isRequired, // only for storybook
    setLogEntries: PropTypes.func.isRequired,
    setPdfDownloadUrl: PropTypes.func.isRequired,
    setPdfLayout: PropTypes.func.isRequired,
    setPdfUrl: PropTypes.func.isRequired,
    setShowLogs: PropTypes.func.isRequired,
    setStopOnValidationError: PropTypes.func.isRequired,
    setUiView: PropTypes.func.isRequired,
    showLogs: PropTypes.bool.isRequired,
    stopCompile: PropTypes.func.isRequired,
    stopOnValidationError: PropTypes.bool.isRequired,
    switchLayout: PropTypes.func.isRequired,
    uncompiled: PropTypes.bool,
    validationIssues: PropTypes.object,
  }),
}

export function usePdfPreviewContext() {
  const context = useContext(PdfPreviewContext)

  if (!context) {
    throw new Error(
      'usePdfPreviewContext is only available inside PdfPreviewProvider'
    )
  }

  return context
}
