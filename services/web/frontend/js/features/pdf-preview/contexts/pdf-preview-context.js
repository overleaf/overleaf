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
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import {
  buildLogEntryAnnotations,
  handleOutputFiles,
} from '../util/output-files'
import {
  send,
  sendMB,
  sendMBSampled,
} from '../../../infrastructure/event-tracking'
import { useEditorContext } from '../../../shared/context/editor-context'
import useAbortController from '../../../shared/hooks/use-abort-controller'
import DocumentCompiler from '../util/compiler'
import { useIdeContext } from '../../../shared/context/ide-context'

export const PdfPreviewContext = createContext(undefined)

PdfPreviewProvider.propTypes = {
  children: PropTypes.any,
}

export default function PdfPreviewProvider({ children }) {
  const ide = useIdeContext()

  const project = useProjectContext()

  const projectId = project._id

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
  const [, setClsiServerId] = useScopeValue('ide.clsiServerId')

  // whether to display the editor and preview side-by-side or full-width ("flat")
  const [pdfLayout, setPdfLayout] = useScopeValue('ui.pdfLayout')

  // what to show in the "flat" view (editor or pdf)
  const [, setUiView] = useScopeValue('ui.view')

  // whether a compile is in progress
  const [compiling, setCompiling] = useState(false)

  // data received in response to a compile request
  const [data, setData] = useState()

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

  // the Document currently open in the editor
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

  // the document compiler
  const [compiler] = useState(() => {
    return new DocumentCompiler({
      project,
      setChangedAt,
      setCompiling,
      setData,
      setError,
      signal,
    })
  })

  // clean up the compiler on unmount
  useEffect(() => {
    return () => {
      compiler.destroy()
    }
  }, [compiler])

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

  // record changes to the autocompile setting
  const setAutoCompile = useCallback(
    value => {
      _setAutoCompile(value)
      sendMB('autocompile-setting-changed', { value })
    },
    [_setAutoCompile]
  )

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
    if (data) {
      if (data.clsiServerId) {
        setClsiServerId(data.clsiServerId) // set in scope, for PdfSynctexController
        compiler.clsiServerId = data.clsiServerId
      }

      if (data.compileGroup) {
        compiler.compileGroup = data.compileGroup
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
          if (!data.options.isAutoCompileOnLoad) {
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
    }
  }, [
    compiler,
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

  // recompile on key press
  useEffect(() => {
    const listener = event => {
      compiler.compile(event.detail)
    }

    window.addEventListener('pdf:recompile', listener)

    return () => {
      window.removeEventListener('pdf:recompile', listener)
    }
  }, [compiler])

  // whether there has been an autocompile linting error, if syntax validation is switched on
  const autoCompileLintingError = Boolean(
    autoCompile && syntaxValidation && hasLintingError
  )

  const codeCheckFailed = stopOnValidationError && autoCompileLintingError

  // show that the project has pending changes
  const hasChanges = Boolean(
    autoCompile && uncompiled && compiledOnce && !codeCheckFailed
  )

  // the project is available for auto-compiling
  const canAutoCompile = Boolean(
    autoCompile && !compiling && !pdfHidden && !codeCheckFailed
  )

  // call the debounced autocompile function if the project is available for auto-compiling and it has changed
  useEffect(() => {
    if (canAutoCompile && changedAt > 0) {
      compiler.debouncedAutoCompile()
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

  // start a compile manually
  const startCompile = useCallback(() => {
    compiler.compile()
  }, [compiler])

  // stop a compile manually
  const stopCompile = useCallback(() => {
    compiler.stopCompile()
  }, [compiler])

  // clear the compile cache
  const clearCache = useCallback(() => {
    setClearingCache(true)

    return compiler.clearCache().finally(() => {
      setClearingCache(false)
    })
  }, [compiler])

  // clear the cache then run a compile, triggered by a menu item
  const recompileFromScratch = useCallback(() => {
    clearCache().then(() => {
      compiler.compile()
    })
  }, [clearCache, compiler])

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
      codeCheckFailed,
      clearCache,
      clearingCache,
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
      recompileFromScratch,
      setAutoCompile,
      setDraft,
      setHasLintingError, // only for stories
      setShowLogs,
      setStopOnValidationError,
      showLogs,
      startCompile,
      stopCompile,
      stopOnValidationError,
      switchLayout,
      uncompiled,
      validationIssues,
    }
  }, [
    autoCompile,
    codeCheckFailed,
    clearCache,
    clearingCache,
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
    recompileFromScratch,
    setAutoCompile,
    setDraft,
    setHasLintingError, // only for stories
    setStopOnValidationError,
    showLogs,
    startCompile,
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
    clearCache: PropTypes.func.isRequired,
    clearingCache: PropTypes.bool.isRequired,
    codeCheckFailed: PropTypes.bool.isRequired,
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
    recompileFromScratch: PropTypes.func.isRequired,
    setAutoCompile: PropTypes.func.isRequired,
    setDraft: PropTypes.func.isRequired,
    setHasLintingError: PropTypes.func.isRequired, // only for storybook
    setShowLogs: PropTypes.func.isRequired,
    setStopOnValidationError: PropTypes.func.isRequired,
    showLogs: PropTypes.bool.isRequired,
    startCompile: PropTypes.func.isRequired,
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
