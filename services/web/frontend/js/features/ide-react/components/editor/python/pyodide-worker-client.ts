import type {
  ProjectFileData,
  PyodideWorkerRequest,
  PyodideWorkerResponse,
} from './pyodide-worker-messages'

export type OutputCallback = (
  stream: 'stdout' | 'stderr',
  line: string,
  requestId?: string
) => void

export type LifecycleCallback = (
  event:
    | { type: 'loaded' }
    | { type: 'loading-failed'; error: string }
    | { type: 'run-finished'; requestId: string }
) => void

export class PyodideWorkerClient {
  private worker: Worker
  private listening = false
  private loaded = false
  private destroyed = false
  private loadingError: string | null = null
  private pendingMessages: PyodideWorkerRequest[] = []
  private outputCallback: OutputCallback | null = null
  private lifecycleCallback: LifecycleCallback | null = null

  constructor(options: { baseAssetPath: string }) {
    const { baseAssetPath } = options

    this.worker = new Worker(
      /* webpackChunkName: "pyodide-worker" */
      new URL('./pyodide.worker.ts', import.meta.url),
      { type: 'module' }
    )

    this.worker.addEventListener('message', this.receive.bind(this))

    this.queueMessage({
      type: 'init',
      baseAssetPath,
    })
  }

  setOutputCallback(callback: OutputCallback) {
    this.outputCallback = callback
  }

  setLifecycleCallback(handler: LifecycleCallback) {
    this.lifecycleCallback = handler

    if (this.loaded) {
      handler({ type: 'loaded' })
      return
    }
    if (this.loadingError) {
      handler({ type: 'loading-failed', error: this.loadingError })
    }
  }

  runCode(
    code: string,
    options: { requestId: string; files: ProjectFileData[] }
  ): void {
    if (this.destroyed) {
      throw new Error('Pyodide worker client has been destroyed')
    }

    if (this.loadingError) {
      throw new Error(this.loadingError)
    }

    this.queueMessage({
      type: 'run-code',
      code,
      id: options.requestId,
      files: options.files,
    })
  }

  destroy() {
    if (this.destroyed) {
      return
    }

    this.destroyed = true
    this.pendingMessages.length = 0

    if (!this.loaded && !this.loadingError) {
      this.loadingError = 'Pyodide worker was destroyed before loading finished'
    }

    this.worker.terminate()
  }

  private queueMessage(message: PyodideWorkerRequest) {
    if (this.listening) {
      this.worker.postMessage(message)
    } else {
      this.pendingMessages.push(message)
    }
  }

  private receive(event: MessageEvent<PyodideWorkerResponse>) {
    const response = event.data

    switch (response.type) {
      case 'listening':
        this.listening = true
        for (const message of this.pendingMessages) {
          this.worker.postMessage(message)
        }
        this.pendingMessages.length = 0
        return

      case 'loaded':
        this.loaded = true
        this.lifecycleCallback?.({ type: 'loaded' })
        return

      case 'loading-failed':
        this.loadingError = response.error
        this.pendingMessages.length = 0
        this.lifecycleCallback?.({
          type: 'loading-failed',
          error: response.error,
        })
        return

      case 'output-line':
        this.outputCallback?.(
          response.stream,
          response.line,
          response.requestId
        )
        break

      case 'run-code-result':
        this.lifecycleCallback?.({
          type: 'run-finished',
          requestId: response.id,
        })
        break
    }
  }
}
