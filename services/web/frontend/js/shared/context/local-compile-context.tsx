import {
  FC,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  Dispatch,
  SetStateAction,
} from 'react'
import useScopeValue from '../hooks/use-scope-value'
import useScopeValueSetterOnly from '../hooks/use-scope-value-setter-only'
import usePersistedState from '../hooks/use-persisted-state'
import useAbortController from '../hooks/use-abort-controller'
import DocumentCompiler from '../../features/pdf-preview/util/compiler'
import {
  send,
  sendMB,
  sendMBOnce,
  sendMBSampled,
} from '../../infrastructure/event-tracking'
import {
  buildLogEntryAnnotations,
  buildRuleCounts,
  buildRuleDeltas,
  handleLogFiles,
  handleOutputFiles,
} from '../../features/pdf-preview/util/output-files'
import { useProjectContext } from './project-context'
import { useEditorContext } from './editor-context'
import { buildFileList } from '../../features/pdf-preview/util/file-list'
import { useLayoutContext } from './layout-context'
import { useUserContext } from './user-context'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import {
  PdfScrollPosition,
  usePdfScrollPosition,
} from '@/shared/hooks/use-pdf-scroll-position'
import { PdfFileDataList } from '@/features/pdf-preview/util/types'

type PdfFile = Record<string, any>

export type CompileContext = {
  autoCompile: boolean
  clearingCache: boolean
  clsiServerId?: string
  codeCheckFailed: boolean
  compiling: boolean
  deliveryLatencies: Record<string, any>
  draft: boolean
  error?: string
  fileList?: PdfFileDataList
  hasChanges: boolean
  hasShortCompileTimeout: boolean
  highlights?: Record<string, any>[]
  isProjectOwner: boolean
  logEntries?: Record<string, any>
  logEntryAnnotations?: Record<string, any>
  outputFilesArchive?: string
  pdfDownloadUrl?: string
  pdfFile?: PdfFile
  pdfUrl?: string
  pdfViewer?: string
  position?: PdfScrollPosition
  rawLog?: string
  setAutoCompile: (value: boolean) => void
  setDraft: (value: any) => void
  setError: (value: any) => void
  setHasLintingError: (value: any) => void // only for storybook
  setHighlights: (value: any) => void
  setPosition: Dispatch<SetStateAction<PdfScrollPosition>>
  setShowCompileTimeWarning: (value: any) => void
  setShowLogs: (value: boolean) => void
  toggleLogs: () => void
  setStopOnFirstError: (value: boolean) => void
  setStopOnValidationError: (value: boolean) => void
  showCompileTimeWarning: boolean
  showLogs: boolean
  stopOnFirstError: boolean
  stopOnValidationError: boolean
  stoppedOnFirstError: boolean
  uncompiled?: boolean
  validationIssues?: Record<string, any>
  firstRenderDone: (metrics: {
    latencyFetch: number
    latencyRender: number | undefined
    pdfCachingMetrics: { viewerId: string }
  }) => void
  cleanupCompileResult?: () => void
  animateCompileDropdownArrow: boolean
  editedSinceCompileStarted: boolean
  lastCompileOptions: any
  setAnimateCompileDropdownArrow: (value: boolean) => void
  recompileFromScratch: () => void
  setCompiling: (value: boolean) => void
  startCompile: (options?: any) => void
  stopCompile: () => void
  setChangedAt: (value: any) => void
  clearCache: () => void
  syncToEntry: (value: any, keepCurrentView?: boolean) => void
  recordAction: (action: string) => void
}

export const LocalCompileContext = createContext<CompileContext | undefined>(
  undefined
)

export const LocalCompileProvider: FC = ({ children }) => {
  const { hasPremiumCompile, isProjectOwner } = useEditorContext()
  const { openDocWithId, openDocs, currentDocument } = useEditorManagerContext()

  const { _id: projectId, rootDocId } = useProjectContext()

  const { pdfPreviewOpen } = useLayoutContext()

  const { features, alphaProgram, labsProgram } = useUserContext()

  const { fileTreeData } = useFileTreeData()
  const { findEntityByPath } = useFileTreePathContext()

  // whether a compile is in progress
  const [compiling, setCompiling] = useState(false)

  // whether to show the compile time warning
  const [showCompileTimeWarning, setShowCompileTimeWarning] = useState(false)

  const [hasShortCompileTimeout, setHasShortCompileTimeout] = useState(false)

  // the log entries parsed from the compile output log
  const [logEntries, setLogEntries] = useScopeValueSetterOnly('pdf.logEntries')

  // annotations for display in the editor, built from the log entries
  const [logEntryAnnotations, setLogEntryAnnotations] = useScopeValue(
    'pdf.logEntryAnnotations'
  )

  // the PDF viewer and whether syntax validation is enabled globally
  const { userSettings } = useUserSettingsContext()
  const { pdfViewer, syntaxValidation } = userSettings

  // the URL for downloading the PDF
  const [, setPdfDownloadUrl] =
    useScopeValueSetterOnly<string>('pdf.downloadUrl')

  // the URL for loading the PDF in the preview pane
  const [, setPdfUrl] = useScopeValueSetterOnly<string>('pdf.url')

  // low level details for metrics
  const [pdfFile, setPdfFile] = useState<PdfFile | undefined>()

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
  const [data, setData] = useState<Record<string, any>>()

  // the rootDocId used in the most recent compile request, which may not be the
  // same as the project rootDocId. This is used to calculate correct paths when
  // parsing the compile logs
  const lastCompileRootDocId = data ? (data.rootDocId ?? rootDocId) : null

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
  const [error, setError] = useState<string>()

  // the list of files that can be downloaded
  const [fileList, setFileList] = useState<PdfFileDataList>()

  // the raw contents of the log file
  const [rawLog, setRawLog] = useState<string>()

  // validation issues from CLSI
  const [validationIssues, setValidationIssues] = useState()

  // areas to highlight on the PDF, from synctex
  const [highlights, setHighlights] = useState()

  const [position, setPosition] = usePdfScrollPosition(lastCompileRootDocId)

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

  // whether the editor linter found errors
  const [hasLintingError, setHasLintingError] = useScopeValue('hasLintingError')

  // the timestamp that a doc was last changed
  const [changedAt, setChangedAt] = useState(0)

  const { signal } = useAbortController()

  const cleanupCompileResult = useCallback(() => {
    setPdfFile(undefined)
    setLogEntries(null)
    setLogEntryAnnotations({})
  }, [setPdfFile, setLogEntries, setLogEntryAnnotations])

  const compilingRef = useRef(false)

  useEffect(() => {
    compilingRef.current = compiling
  }, [compiling])

  const _buildLogEntryAnnotations = useCallback(
    entries =>
      buildLogEntryAnnotations(entries, fileTreeData, lastCompileRootDocId),
    [fileTreeData, lastCompileRootDocId]
  )

  const buildLogEntryAnnotationsRef = useRef(_buildLogEntryAnnotations)

  useEffect(() => {
    buildLogEntryAnnotationsRef.current = _buildLogEntryAnnotations
  }, [_buildLogEntryAnnotations])

  // the document compiler
  const [compiler] = useState(() => {
    return new DocumentCompiler({
      projectId,
      setChangedAt,
      setCompiling,
      setData,
      setFirstRenderDone,
      setDeliveryLatencies,
      setError,
      cleanupCompileResult,
      compilingRef,
      signal,
      openDocs,
    })
  })

  // keep currentDoc in sync with the compiler
  useEffect(() => {
    compiler.currentDoc = currentDocument
  }, [compiler, currentDocument])

  // keep the project rootDocId in sync with the compiler
  useEffect(() => {
    compiler.projectRootDocId = rootDocId
  }, [compiler, rootDocId])

  // keep draft setting in sync with the compiler
  useEffect(() => {
    compiler.setOption('draft', draft)
  }, [compiler, draft])

  // keep stop on first error setting in sync with the compiler
  useEffect(() => {
    compiler.setOption('stopOnFirstError', stopOnFirstError)
  }, [compiler, stopOnFirstError])

  useEffect(() => {
    setUncompiled(changedAt > 0)
  }, [setUncompiled, changedAt])

  useEffect(() => {
    setEditedSinceCompileStarted(changedAt > 0)
  }, [setEditedSinceCompileStarted, changedAt])

  // always compile the PDF once after opening the project, after the doc has loaded
  useEffect(() => {
    if (!compiledOnce && currentDocument) {
      setCompiledOnce(true)
      compiler.compile({ isAutoCompileOnLoad: true })
    }
  }, [compiledOnce, currentDocument, compiler])

  useEffect(() => {
    setHasShortCompileTimeout(
      features?.compileTimeout !== undefined && features.compileTimeout <= 60
    )
  }, [features])

  useEffect(() => {
    if (hasShortCompileTimeout && compiling && isProjectOwner) {
      const timeout = window.setTimeout(() => {
        setShowCompileTimeWarning(true)
      }, 30000)

      return () => {
        window.clearTimeout(timeout)
      }
    }
  }, [compiling, isProjectOwner, hasShortCompileTimeout])

  const hasCompileLogsEvents = useFeatureFlag('compile-log-events')

  // compare log entry counts with the previous compile, and record actions between compiles
  // these are refs rather than state so they don't trigger the effect to run
  const previousRuleCountsRef = useRef<{
    ruleCounts: Record<string, number>
    rootDocId: string
  } | null>(null)
  const recordedActionsRef = useRef<Record<string, boolean>>({})
  const recordAction = useCallback((action: string) => {
    recordedActionsRef.current[action] = true
  }, [])

  // handle the data returned from a compile request
  // note: this should _only_ run when `data` changes,
  // the other dependencies must all be static
  useEffect(() => {
    const abortController = new AbortController()

    const recordedActions = recordedActionsRef.current
    recordedActionsRef.current = {}

    if (data) {
      if (data.clsiServerId) {
        setClsiServerId(data.clsiServerId) // set in scope, for PdfSynctexController
      }

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
          buildFileList(
            outputFiles,
            data.clsiServerId,
            data.compileGroup,
            data.outputFilesArchive
          )
        )

        // handle log files
        // asynchronous (TODO: cancel on new compile?)
        setLogEntryAnnotations(null)
        setLogEntries(null)
        setRawLog(undefined)

        handleLogFiles(outputFiles, data, abortController.signal).then(
          (result: Record<string, any>) => {
            setRawLog(result.log)
            setLogEntries(result.logEntries)
            setLogEntryAnnotations(
              buildLogEntryAnnotationsRef.current(result.logEntries.all)
            )

            // sample compile stats for real users
            if (!alphaProgram) {
              if (['success', 'stopped-on-first-error'].includes(data.status)) {
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

              if (hasCompileLogsEvents || labsProgram) {
                const ruleCounts = buildRuleCounts(
                  result.logEntries.all
                ) as Record<string, number>

                const rootDocId = data.rootDocId || compiler.projectRootDocId

                const previousRuleCounts = previousRuleCountsRef.current
                previousRuleCountsRef.current = { ruleCounts, rootDocId }

                const ruleDeltas =
                  previousRuleCounts &&
                  previousRuleCounts.rootDocId === rootDocId
                    ? buildRuleDeltas(ruleCounts, previousRuleCounts.ruleCounts)
                    : {}

                sendMB('compile-log-entries', {
                  status: data.status,
                  stopOnFirstError: data.options.stopOnFirstError,
                  isAutoCompileOnLoad: !!data.options.isAutoCompileOnLoad,
                  isAutoCompileOnChange: !!data.options.isAutoCompileOnChange,
                  rootDocId,
                  ...recordedActions,
                  ...ruleCounts,
                  ...ruleDeltas,
                })
              }
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
    alphaProgram,
    labsProgram,
    features,
    hasCompileLogsEvents,
    hasPremiumCompile,
    isProjectOwner,
    projectId,
    setAutoCompile,
    setClsiServerId,
    setLogEntries,
    setLogEntryAnnotations,
    setPdfFile,
    compiler,
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
        setPdfFile(undefined)
      })
      .finally(() => {
        setClearingCache(false)
      })
  }, [compiler])

  const syncToEntry = useCallback(
    (entry, keepCurrentView = false) => {
      const result = findEntityByPath(entry.file)

      if (result && result.type === 'doc') {
        openDocWithId(result.entity._id, {
          gotoLine: entry.line ?? undefined,
          gotoColumn: entry.column ?? undefined,
          keepCurrentView,
        })
      }
    },
    [findEntityByPath, openDocWithId]
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

  useEffect(() => {
    const listener = (event: Event) => {
      setShowLogs((event as CustomEvent<boolean>).detail as boolean)
    }

    window.addEventListener('editor:show-logs', listener)

    return () => {
      window.removeEventListener('editor:show-logs', listener)
    }
  }, [])

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
      setShowLogs,
      toggleLogs,
      syncToEntry,
      recordAction,
    ]
  )

  return (
    <LocalCompileContext.Provider value={value}>
      {children}
    </LocalCompileContext.Provider>
  )
}

export function useLocalCompileContext() {
  const context = useContext(LocalCompileContext)
  if (!context) {
    throw new Error(
      'useLocalCompileContext is only available inside LocalCompileProvider'
    )
  }
  return context
}
