import { isMainFile } from './editor-files'
import getMeta from '../../../utils/meta'
import { deleteJSON, postJSON } from '../../../infrastructure/fetch-json'
import { debounce, DebouncedFunc } from 'lodash'
import { EDITOR_SESSION_ID, trackPdfDownload } from './metrics'
import { enablePdfCaching } from './pdf-caching-flags'
import { debugConsole } from '@/utils/debugging'
import { signalWithTimeout } from '@/utils/abort-signal'
import { Dispatch, SetStateAction } from 'react'
import { OpenDocuments } from '@/features/ide-react/editor/open-documents'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import { CompileOptions, CompileResponseData } from '@ol-types/compile'
import { DeliveryLatencies } from './types'

const AUTO_COMPILE_MAX_WAIT = 5000
// We add a 2 second debounce to sending user changes to server if they aren't
// collaborating with anyone. This needs to be higher than SINGLE_USER_FLUSH_DELAY, and allow for
// client to server latency, otherwise we compile before the op reaches the server
// and then again on ack.
const AUTO_COMPILE_DEBOUNCE = 2500

// If there is a pending op, wait for it to be saved before compiling
const PENDING_OP_MAX_WAIT = 10000

const searchParams = new URLSearchParams(window.location.search)

export default class DocumentCompiler {
  compilingRef: React.MutableRefObject<boolean>
  projectId: string
  setChangedAt: Dispatch<SetStateAction<number>>
  setCompiling: Dispatch<SetStateAction<boolean>>
  setData: Dispatch<SetStateAction<CompileResponseData | undefined>>
  setFirstRenderDone: Dispatch<SetStateAction<() => void>>
  setDeliveryLatencies: Dispatch<SetStateAction<DeliveryLatencies>>
  setError: Dispatch<SetStateAction<string | undefined>>
  cleanupCompileResult: () => void
  signal: AbortSignal
  openDocs: OpenDocuments
  projectRootDocId?: string | null
  clsiServerId: string | null
  currentDoc: DocumentContainer | null
  error: Error | undefined
  timer: number
  defaultOptions: CompileOptions
  debouncedAutoCompile: DebouncedFunc<() => void>

  constructor({
    compilingRef,
    projectId,
    setChangedAt,
    setCompiling,
    setData,
    setFirstRenderDone,
    setDeliveryLatencies,
    setError,
    cleanupCompileResult,
    signal,
    openDocs,
  }: {
    compilingRef: React.MutableRefObject<boolean>
    projectId: string
    setChangedAt: Dispatch<SetStateAction<number>>
    setCompiling: Dispatch<SetStateAction<boolean>>
    setData: Dispatch<SetStateAction<CompileResponseData | undefined>>
    setFirstRenderDone: Dispatch<SetStateAction<() => void>>
    setDeliveryLatencies: Dispatch<SetStateAction<DeliveryLatencies>>
    setError: Dispatch<SetStateAction<string | undefined>>
    cleanupCompileResult: () => void
    signal: AbortSignal
    openDocs: OpenDocuments
  }) {
    this.compilingRef = compilingRef
    this.projectId = projectId
    this.setChangedAt = setChangedAt
    this.setCompiling = setCompiling
    this.setData = setData
    this.setFirstRenderDone = setFirstRenderDone
    this.setDeliveryLatencies = setDeliveryLatencies
    this.setError = setError
    this.cleanupCompileResult = cleanupCompileResult
    this.signal = signal
    this.openDocs = openDocs

    this.projectRootDocId = null
    this.clsiServerId = null
    this.currentDoc = null
    this.error = undefined
    this.timer = 0
    this.defaultOptions = {
      draft: false,
      stopOnFirstError: false,
    }

    this.debouncedAutoCompile = debounce(
      () => {
        this.compile({ isAutoCompileOnChange: true })
      },
      AUTO_COMPILE_DEBOUNCE,
      {
        maxWait: AUTO_COMPILE_MAX_WAIT,
      }
    )
  }

  // The main "compile" function.
  // Call this directly to run a compile now, otherwise call debouncedAutoCompile.
  async compile(options: CompileOptions = {}) {
    options = { ...this.defaultOptions, ...options }

    if (options.isAutoCompileOnLoad && getMeta('ol-preventCompileOnLoad')) {
      return
    }

    // set "compiling" to true (in the React component's state), and return if it was already true
    const wasCompiling = this.compilingRef.current
    this.setCompiling(true)

    if (wasCompiling) {
      if (options.isAutoCompileOnChange) {
        this.debouncedAutoCompile()
      }
      return
    }

    try {
      await this.openDocs.awaitBufferedOps(
        signalWithTimeout(this.signal, PENDING_OP_MAX_WAIT)
      )

      // reset values
      this.setChangedAt(0) // TODO: wait for doc:saved?

      const params = this.buildCompileParams(options)

      const t0 = performance.now()

      const rootDocId = this.getRootDocOverrideId()

      const body = {
        rootDoc_id: rootDocId,
        draft: options.draft,
        check: 'silent', // NOTE: 'error' and 'validate' are possible, but unused
        // use incremental compile for all users but revert to a full compile
        // if there was previously a server error
        incrementalCompilesEnabled: !this.error,
        stopOnFirstError: options.stopOnFirstError,
        editorId: EDITOR_SESSION_ID,
      }

      const data: CompileResponseData = await postJSON(
        `/project/${this.projectId}/compile?${params}`,
        { body, signal: this.signal }
      )

      const compileTimeClientE2E = Math.ceil(performance.now() - t0)
      const { deliveryLatencies, firstRenderDone } = trackPdfDownload(
        data,
        compileTimeClientE2E,
        t0
      )
      this.setDeliveryLatencies(() => deliveryLatencies)
      this.setFirstRenderDone(() => firstRenderDone)

      // unset the error before it's set again later, so that components are recreated and events are tracked
      this.setError(undefined)

      data.options = options
      data.rootDocId = rootDocId
      if (data.clsiServerId) {
        this.clsiServerId = data.clsiServerId
      }
      this.setData(data)
    } catch (error: any) {
      debugConsole.error(error)
      this.cleanupCompileResult()
      this.setError(error.info?.statusCode === 429 ? 'rate-limited' : 'error')
    } finally {
      this.setCompiling(false)
    }
  }

  // parse the text of the current doc in the editor
  // if it contains "\documentclass" then use this as the root doc
  getRootDocOverrideId() {
    // only override when not in the root doc itself
    if (this.currentDoc && this.currentDoc.doc_id !== this.projectRootDocId) {
      const snapshot = this.currentDoc.getSnapshot()

      if (snapshot && isMainFile(snapshot)) {
        return this.currentDoc.doc_id
      }
    }

    return null
  }

  // build the query parameters added to post-compile requests
  buildPostCompileParams() {
    const params = new URLSearchParams()

    // the id of the CLSI server that processed the previous compile request
    if (this.clsiServerId) {
      params.set('clsiserverid', this.clsiServerId)
    }

    return params
  }

  // build the query parameters for the compile request
  buildCompileParams(options: CompileOptions) {
    const params = new URLSearchParams()

    // note: no clsiserverid query param is set on "compile" requests,
    // as this is added in the backend by the web api

    // tell the server whether this is an automatic or manual compile request
    if (options.isAutoCompileOnLoad || options.isAutoCompileOnChange) {
      params.set('auto_compile', 'true')
    }

    // use the feature flag to enable PDF caching
    if (enablePdfCaching) {
      params.set('enable_pdf_caching', 'true')
    }

    // use the feature flag to enable "file line errors"
    if (searchParams.get('file_line_errors') === 'true') {
      params.set('file_line_errors', 'true')
    }

    return params
  }

  // send a request to stop the current compile
  stopCompile() {
    // NOTE: no stoppingCompile state, as this should happen fairly quickly
    // and doesn't matter if it runs twice.

    const params = this.buildPostCompileParams()

    return postJSON(`/project/${this.projectId}/compile/stop?${params}`, {
      signal: this.signal,
    })
      .catch(error => {
        debugConsole.error(error)
        this.setError('error')
      })
      .finally(() => {
        this.setCompiling(false)
      })
  }

  // send a request to clear the cache
  clearCache() {
    const params = this.buildPostCompileParams()

    return deleteJSON(`/project/${this.projectId}/output?${params}`, {
      signal: this.signal,
    }).catch(error => {
      debugConsole.error(error)
      this.setError('clear-cache')
    })
  }

  setOption<Key extends keyof CompileOptions>(
    option: Key,
    value: CompileOptions[Key]
  ) {
    this.defaultOptions[option] = value
  }
}
