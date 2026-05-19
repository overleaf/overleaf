// Per-file Python execution manager. Each PythonRunner owns a PyodideWorkerClient
// and exposes a subscribe/getState API for use with useSyncExternalStore,
// so React components can reactively read execution status and output.
import path from 'path-browserify'
import { v4 as uuid } from 'uuid'
import { debugConsole } from '@/utils/debugging'
import { sendMB } from '@/infrastructure/event-tracking'
import { PyodideWorkerClient } from './pyodide-worker-client'
import { showPythonFilesSavedToast } from './python-output-toasts'
import type { OutputStream } from './pyodide-worker-messages'
import type {
  BatchUploadItem,
  UploadResult,
} from '@/infrastructure/batch-file-uploader'

export type FileUploader = (items: BatchUploadItem[]) => Promise<UploadResult[]>

const MAX_OUTPUT_LINES = 100
const PROJECT_FS_PREFIX = '/project/'

function stripProjectFsPrefix(p: string): string {
  return p.startsWith(PROJECT_FS_PREFIX) ? p.slice(PROJECT_FS_PREFIX.length) : p
}

export type ExecutionStatus =
  | 'loading'
  | 'idle'
  | 'running'
  | 'finished'
  | 'errored'

export type ExecutionContext = {
  code: string
  files: { relativePath: string; content: string }[]
}

type Listener = () => void

export type OutputLine = {
  stream: OutputStream
  line: string
}

export type PythonRunnerState = {
  output: OutputLine[]
  status: ExecutionStatus
  error: string | null
}

export const DEFAULT_STATE: PythonRunnerState = {
  output: [],
  status: 'loading',
  error: null,
}

export class PythonRunner {
  readonly fileId: string
  private client: PyodideWorkerClient | null = null
  private readonly baseAssetPath: string
  private readonly createWorker: () => Worker
  private readonly getExecutionContext: () => Promise<ExecutionContext | null>
  private readonly fileUploader: FileUploader

  private listeners = new Set<Listener>()

  private activeExecution: { id: string; startedAt: number } | null = null
  private state: PythonRunnerState = DEFAULT_STATE

  constructor(
    fileId: string,
    baseAssetPath: string,
    getExecutionContext: () => Promise<ExecutionContext | null>,
    createWorker: () => Worker,
    fileUploader: FileUploader
  ) {
    this.fileId = fileId
    this.baseAssetPath = baseAssetPath
    this.createWorker = createWorker
    this.getExecutionContext = getExecutionContext
    this.fileUploader = fileUploader
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = () => this.state

  private updateState(fields: Partial<PythonRunnerState>) {
    const prev = this.state
    const output = fields.output ?? prev.output
    const status = fields.status ?? prev.status
    const error = fields.error !== undefined ? fields.error : prev.error

    if (
      output === prev.output &&
      status === prev.status &&
      error === prev.error
    ) {
      return
    }

    this.state = { output, status, error }

    for (const listener of this.listeners) {
      listener()
    }
  }

  init() {
    if (this.client) {
      return
    }

    this.updateState({ status: 'loading', error: null })

    this.client = new PyodideWorkerClient({
      baseAssetPath: this.baseAssetPath,
      createWorker: this.createWorker,
      fileUploader: this.fileUploader,
      onLifecycle: event => {
        switch (event.type) {
          case 'loaded':
            this.updateState({ status: 'idle', error: null })
            return

          case 'loading-failed':
            debugConsole.error('Failed to load Python runtime', event.error)
            this.updateState({ status: 'errored', error: event.error })
            return

          case 'run-finished': {
            const active = this.activeExecution
            if (
              event.fileId !== this.fileId ||
              active?.id !== event.executionId
            ) {
              return
            }

            this.activeExecution = null

            sendMB('script-runner-execution-completed', {
              result: event.success ? 'success' : 'error',
              errorType: event.success ? undefined : event.errorType,
              executionTimeMs: Math.round(performance.now() - active.startedAt),
              filesImportedCount: event.imports.length,
              filesImportedExtensions: collectExtensions(event.imports),
              filesWrittenCount: event.outputs.length,
              filesWrittenExtensions: collectExtensions(event.outputs),
            })

            // event.outputs are full worker paths (/project/foo.txt) while
            // event.failedUploads are relativePaths (foo.txt); strip the
            // prefix before comparing.
            const failed = new Set(event.failedUploads)
            const uploadedPaths = event.outputs
              .map(stripProjectFsPrefix)
              .filter(p => !failed.has(p))
            if (uploadedPaths.length > 0) {
              showPythonFilesSavedToast(uploadedPaths)
            }

            this.updateState({ status: 'finished' })
          }
        }
      },
      onOutput: (stream, line, fileId, executionId) => {
        if (
          fileId !== this.fileId ||
          this.activeExecution?.id !== executionId
        ) {
          return
        }
        this.updateState({
          output: appendCapped(this.state.output, { stream, line }),
        })
      },
    })
  }

  async run() {
    if (!this.client || this.state.status === 'loading') {
      return
    }

    let context: ExecutionContext | null
    try {
      context = await this.getExecutionContext()
    } catch (err) {
      debugConsole.error('Failed to build execution context', err)
      this.updateState({ status: 'errored', error: formatError(err) })
      return
    }

    // Re-check after await — status may have changed but TypeScript
    // still narrows from the pre-await check, so we cast back.
    if (
      !context ||
      !this.client ||
      (this.state.status as ExecutionStatus) === 'loading'
    ) {
      return
    }

    const { code, files } = context

    sendMB('script-runner-run-clicked', {
      scriptLineCount: countLines(code),
    })

    const executionId = uuid()
    this.activeExecution = { id: executionId, startedAt: performance.now() }
    this.updateState({ status: 'running', output: [], error: null })

    try {
      this.client.runCode(code, {
        fileId: this.fileId,
        executionId,
        files,
      })
    } catch (runError) {
      if (this.activeExecution?.id !== executionId) {
        return
      }
      this.activeExecution = null
      this.updateState({ status: 'errored', error: formatError(runError) })
    }
  }

  interrupt() {
    if (!this.client) {
      return
    }

    if (this.state.status === 'running' && this.activeExecution) {
      sendMB('script-runner-stop-clicked', {
        timeBeforeStopMs: Math.round(
          performance.now() - this.activeExecution.startedAt
        ),
      })
    }

    this.client.reset()
    this.activeExecution = null

    // The worker is terminated and recreated by reset(), so it needs to
    // reload Pyodide. The 'loaded' lifecycle callback will transition
    // back to 'idle'.
    this.updateState({
      status: 'loading',
      output:
        this.state.status === 'running'
          ? appendCapped(this.state.output, {
              stream: 'info',
              line: 'Execution interrupted',
            })
          : this.state.output,
    })
  }

  destroy() {
    if (this.client) {
      this.client.destroy()
      this.client = null
    }
  }
}

function appendCapped(existing: OutputLine[], entry: OutputLine): OutputLine[] {
  const updated = [...existing, entry]
  return updated.length > MAX_OUTPUT_LINES
    ? updated.slice(-MAX_OUTPUT_LINES)
    : updated
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function countLines(code: string): number {
  if (code.length === 0) {
    return 0
  }
  return code.split('\n').length
}

function extractExtension(filePath: string): string {
  return path.extname(filePath).slice(1).toLowerCase()
}

function collectExtensions(filePaths: string[]): string {
  const seen = new Set<string>()
  for (const filePath of filePaths) {
    const ext = extractExtension(filePath)
    if (ext) {
      seen.add(ext)
    }
  }
  return Array.from(seen).join(',')
}
