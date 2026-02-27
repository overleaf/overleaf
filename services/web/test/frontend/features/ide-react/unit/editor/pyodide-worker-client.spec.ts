import { expect } from 'chai'
import { PyodideWorkerClient } from '@/features/ide-react/components/editor/python/pyodide-worker-client'

type WorkerMessageListener = (event: MessageEvent) => void

const BASE_ASSET_PATH = 'https://assets.example.test/'

class WorkerMock {
  static instances: WorkerMock[] = []

  readonly postedMessages: any[] = []
  terminated = false
  private messageListeners: WorkerMessageListener[] = []

  constructor() {
    WorkerMock.instances.push(this)
  }

  addEventListener(type: string, listener: WorkerMessageListener) {
    if (type === 'message') {
      this.messageListeners.push(listener)
    }
  }

  postMessage(message: unknown) {
    this.postedMessages.push(message)
  }

  terminate() {
    this.terminated = true
  }

  emitMessage(message: unknown) {
    for (const listener of this.messageListeners) {
      listener({ data: message } as MessageEvent)
    }
  }
}

describe('PyodideWorkerClient', function () {
  let originalWorker: typeof Worker | undefined

  beforeEach(function () {
    originalWorker = window.Worker
    // @ts-ignore - allow mocking Worker
    window.Worker = WorkerMock
    WorkerMock.instances.length = 0
  })

  afterEach(function () {
    if (originalWorker) {
      window.Worker = originalWorker
    }
  })

  it('queues runCode until the worker reports listening', function () {
    const client = new PyodideWorkerClient({ baseAssetPath: BASE_ASSET_PATH })
    const worker = WorkerMock.instances[0]

    client.runCode('print("ok")', {
      requestId: 'main.py',
      files: [{ relativePath: 'main.py', content: 'print("ok")' }],
    })
    expect(worker.postedMessages).to.have.length(0)

    worker.emitMessage({ type: 'listening' })
    expect(worker.postedMessages.map(message => message.type)).to.deep.equal([
      'init',
      'run-code',
    ])

    const runRequest = worker.postedMessages.find(
      message => message.type === 'run-code'
    )
    expect(runRequest).to.include({
      type: 'run-code',
      id: 'main.py',
      code: 'print("ok")',
    })
    expect(runRequest.files).to.deep.equal([
      { relativePath: 'main.py', content: 'print("ok")' },
    ])
  })

  it('sends runCode as fire-and-forget', function () {
    const client = new PyodideWorkerClient({ baseAssetPath: BASE_ASSET_PATH })
    const worker = WorkerMock.instances[0]
    worker.emitMessage({ type: 'listening' })

    client.runCode('raise RuntimeError("boom")', {
      requestId: 'boom.py',
      files: [],
    })
    const runRequest = worker.postedMessages.find(
      message => message.type === 'run-code'
    )
    expect(runRequest).to.include({ type: 'run-code', id: 'boom.py' })
  })

  it('emits run-finished lifecycle event from run-code-result', function () {
    const client = new PyodideWorkerClient({ baseAssetPath: BASE_ASSET_PATH })
    const worker = WorkerMock.instances[0]
    const lifecycleEvents: Array<{ type: string; requestId?: string }> = []

    client.setLifecycleCallback(event => {
      lifecycleEvents.push(event)
    })
    worker.emitMessage({ type: 'listening' })

    client.runCode('print("ok")', { requestId: 'main.py', files: [] })
    worker.emitMessage({
      type: 'run-code-result',
      id: 'main.py',
    })

    expect(lifecycleEvents).to.deep.include({
      type: 'run-finished',
      requestId: 'main.py',
    })
  })

  it('reports lifecycle failure and rejects future run requests when loading fails', function () {
    const client = new PyodideWorkerClient({ baseAssetPath: BASE_ASSET_PATH })
    const worker = WorkerMock.instances[0]
    const lifecycleEvents: Array<{ type: string; error?: string }> = []

    client.setLifecycleCallback(event => {
      lifecycleEvents.push(event)
    })

    worker.emitMessage({
      type: 'loading-failed',
      error: 'runtime unavailable',
    })

    expect(lifecycleEvents).to.deep.equal([
      { type: 'loading-failed', error: 'runtime unavailable' },
    ])
    expect(() =>
      client.runCode('print("ok")', { requestId: 'main.py', files: [] })
    ).to.throw('runtime unavailable')
  })

  it('terminates the worker even when destroy is called after loading failure', function () {
    const client = new PyodideWorkerClient({ baseAssetPath: BASE_ASSET_PATH })
    const worker = WorkerMock.instances[0]

    worker.emitMessage({
      type: 'loading-failed',
      error: 'runtime unavailable',
    })
    client.destroy()

    expect(worker.terminated).to.equal(true)
  })
})
