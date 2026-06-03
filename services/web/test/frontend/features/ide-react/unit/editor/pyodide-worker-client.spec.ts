import { expect } from 'chai'
import sinon from 'sinon'
import {
  PyodideWorkerClient,
  type LifecycleCallback,
  type OutputCallback,
} from '@/features/ide-react/components/editor/python/pyodide-worker-client'
import type { FileUploader } from '@/features/ide-react/components/editor/python/python-runner'
import { WorkerMock, createWorker } from './worker-mock'

const BASE_ASSET_PATH = 'https://assets.example.test/'

const fileUploaderStub: FileUploader = () => Promise.resolve([])

describe('PyodideWorkerClient', function () {
  beforeEach(function () {
    WorkerMock.instances.length = 0
  })

  it('queues runCode until the worker reports listening', function () {
    const client = new PyodideWorkerClient({
      baseAssetPath: BASE_ASSET_PATH,
      createWorker,
      fileUploader: fileUploaderStub,
    })
    const worker = WorkerMock.instances[0]

    client.runCode('print("ok")', {
      fileId: 'main.py',
      executionId: 'exec-1',
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
      fileId: 'main.py',
      executionId: 'exec-1',
      code: 'print("ok")',
    })
    expect(runRequest.files).to.deep.equal([
      { relativePath: 'main.py', content: 'print("ok")' },
    ])
  })

  it('sends runCode as fire-and-forget', function () {
    const client = new PyodideWorkerClient({
      baseAssetPath: BASE_ASSET_PATH,
      createWorker,
      fileUploader: fileUploaderStub,
    })
    const worker = WorkerMock.instances[0]
    worker.emitMessage({ type: 'listening' })

    client.runCode('raise RuntimeError("boom")', {
      fileId: 'boom.py',
      executionId: 'exec-2',
      files: [],
    })
    const runRequest = worker.postedMessages.find(
      message => message.type === 'run-code'
    )
    expect(runRequest).to.include({
      type: 'run-code',
      fileId: 'boom.py',
      executionId: 'exec-2',
    })
  })

  function setupClientWithLifecycleTracking() {
    const lifecycleEvents: Parameters<LifecycleCallback>[0][] = []

    const client = new PyodideWorkerClient({
      baseAssetPath: BASE_ASSET_PATH,
      createWorker,
      onLifecycle: event => {
        lifecycleEvents.push(event)
      },
      fileUploader: fileUploaderStub,
    })
    const worker = WorkerMock.instances[0]
    worker.emitMessage({ type: 'listening' })
    return { client, worker, lifecycleEvents }
  }

  function setupClientWithUploadTracking(options: {
    fileUploader: FileUploader
  }) {
    const lifecycleEvents: Parameters<LifecycleCallback>[0][] = []
    const outputCalls: Parameters<OutputCallback>[] = []

    const client = new PyodideWorkerClient({
      baseAssetPath: BASE_ASSET_PATH,
      createWorker,
      onLifecycle: event => {
        lifecycleEvents.push(event)
      },
      onOutput: (...args) => {
        outputCalls.push(args)
      },
      fileUploader: options.fileUploader,
    })
    const worker = WorkerMock.instances[0]
    worker.emitMessage({ type: 'listening' })
    return { client, worker, lifecycleEvents, outputCalls }
  }

  async function waitFor(predicate: () => boolean, timeoutMs = 200) {
    const deadline = Date.now() + timeoutMs
    while (!predicate()) {
      if (Date.now() > deadline) {
        throw new Error('waitFor timed out')
      }
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  it('emits run-finished lifecycle event from run-code-result', function () {
    const { client, worker, lifecycleEvents } =
      setupClientWithLifecycleTracking()

    client.runCode('print("ok")', {
      fileId: 'main.py',
      executionId: 'exec-3',
      files: [],
    })
    worker.emitMessage({
      type: 'run-code-result',
      fileId: 'main.py',
      executionId: 'exec-3',
      success: true,
      outputs: ['/project/output.txt'],
      outputFiles: [],
      imports: [],
    })

    expect(lifecycleEvents).to.deep.equal([
      {
        type: 'run-finished',
        fileId: 'main.py',
        executionId: 'exec-3',
        success: true,
        outputs: ['/project/output.txt'],
        failedUploads: [],
        imports: [],
        errorType: undefined,
      },
    ])
  })

  it('surfaces outputs array from run-code-result with multiple files', function () {
    const { client, worker, lifecycleEvents } =
      setupClientWithLifecycleTracking()

    client.runCode('write_files()', {
      fileId: 'main.py',
      executionId: 'exec-4',
      files: [],
    })
    worker.emitMessage({
      type: 'run-code-result',
      fileId: 'main.py',
      executionId: 'exec-4',
      success: true,
      outputs: ['/project/fig1.png', '/project/results/data.csv'],
      outputFiles: [],
      imports: [],
    })

    expect(lifecycleEvents).to.deep.equal([
      {
        type: 'run-finished',
        fileId: 'main.py',
        executionId: 'exec-4',
        success: true,
        outputs: ['/project/fig1.png', '/project/results/data.csv'],
        failedUploads: [],
        imports: [],
        errorType: undefined,
      },
    ])
  })

  it('surfaces empty outputs when no project files were written', function () {
    const { client, worker, lifecycleEvents } =
      setupClientWithLifecycleTracking()

    client.runCode('print("no writes")', {
      fileId: 'main.py',
      executionId: 'exec-5',
      files: [],
    })
    worker.emitMessage({
      type: 'run-code-result',
      fileId: 'main.py',
      executionId: 'exec-5',
      success: true,
      outputs: [],
      outputFiles: [],
      imports: [],
    })

    expect(lifecycleEvents).to.deep.equal([
      {
        type: 'run-finished',
        fileId: 'main.py',
        executionId: 'exec-5',
        success: true,
        outputs: [],
        failedUploads: [],
        imports: [],
        errorType: undefined,
      },
    ])
  })

  it('surfaces success and outputFiles from run-code-result', async function () {
    const { client, worker, lifecycleEvents } =
      setupClientWithLifecycleTracking()

    client.runCode('write_files()', {
      fileId: 'main.py',
      executionId: 'exec-success',
      files: [],
    })
    const csvContent = new Uint8Array([1, 2, 3])
    const pngContent = new Uint8Array([4, 5, 6, 7])
    worker.emitMessage({
      type: 'run-code-result',
      fileId: 'main.py',
      executionId: 'exec-success',
      success: true,
      outputs: ['/project/data.csv', '/project/plot.png'],
      outputFiles: [
        { relativePath: 'data.csv', content: csvContent },
        { relativePath: 'plot.png', content: pngContent },
      ],
      imports: [],
    })

    await waitFor(() =>
      Boolean(lifecycleEvents.find(e => e.type === 'run-finished'))
    )

    const finished = lifecycleEvents.find(e => e.type === 'run-finished')
    expect(finished).to.deep.equal({
      type: 'run-finished',
      fileId: 'main.py',
      executionId: 'exec-success',
      success: true,
      outputs: ['/project/data.csv', '/project/plot.png'],
      failedUploads: [],
      imports: [],
      errorType: undefined,
    })
  })

  it('propagates ModuleNotFoundError errorType on run-finished', function () {
    const { client, worker, lifecycleEvents } =
      setupClientWithLifecycleTracking()

    client.runCode('import nope', {
      fileId: 'main.py',
      executionId: 'exec-mnfe',
      files: [],
    })
    worker.emitMessage({
      type: 'run-code-result',
      fileId: 'main.py',
      executionId: 'exec-mnfe',
      success: false,
      outputs: [],
      outputFiles: [],
      imports: [],
      errorType: 'ModuleNotFoundError',
    })

    const finished = lifecycleEvents.find(e => e.type === 'run-finished')
    expect(finished).to.deep.equal({
      type: 'run-finished',
      fileId: 'main.py',
      executionId: 'exec-mnfe',
      success: false,
      outputs: [],
      failedUploads: [],
      imports: [],
      errorType: 'ModuleNotFoundError',
    })
  })

  it('surfaces success: false with empty outputFiles on script error', function () {
    const { client, worker, lifecycleEvents } =
      setupClientWithLifecycleTracking()

    client.runCode('raise RuntimeError("boom")', {
      fileId: 'main.py',
      executionId: 'exec-error',
      files: [],
    })
    worker.emitMessage({
      type: 'run-code-result',
      fileId: 'main.py',
      executionId: 'exec-error',
      success: false,
      outputs: [],
      outputFiles: [],
      imports: [],
      errorType: 'generic',
    })

    const finished = lifecycleEvents.find(e => e.type === 'run-finished')
    expect(finished).to.deep.equal({
      type: 'run-finished',
      fileId: 'main.py',
      executionId: 'exec-error',
      success: false,
      outputs: [],
      failedUploads: [],
      imports: [],
      errorType: 'generic',
    })
  })

  it('surfaces empty outputFiles when success but no files were written', function () {
    const { client, worker, lifecycleEvents } =
      setupClientWithLifecycleTracking()

    client.runCode('print("no writes")', {
      fileId: 'main.py',
      executionId: 'exec-nowrites',
      files: [],
    })
    worker.emitMessage({
      type: 'run-code-result',
      fileId: 'main.py',
      executionId: 'exec-nowrites',
      success: true,
      outputs: [],
      outputFiles: [],
      imports: [],
    })

    const finished = lifecycleEvents.find(e => e.type === 'run-finished')
    expect(finished).to.deep.equal({
      type: 'run-finished',
      fileId: 'main.py',
      executionId: 'exec-nowrites',
      success: true,
      outputs: [],
      failedUploads: [],
      imports: [],
      errorType: undefined,
    })
  })

  it('reports lifecycle failure and rejects future run requests when loading fails', function () {
    const lifecycleEvents: { type: string; error?: string }[] = []

    const client = new PyodideWorkerClient({
      baseAssetPath: BASE_ASSET_PATH,
      createWorker,
      onLifecycle: event => {
        lifecycleEvents.push(event)
      },
      fileUploader: fileUploaderStub,
    })
    const worker = WorkerMock.instances[0]

    worker.emitMessage({
      type: 'loading-failed',
      error: 'runtime unavailable',
    })

    expect(lifecycleEvents).to.deep.equal([
      { type: 'loading-failed', error: 'runtime unavailable' },
    ])
    expect(() =>
      client.runCode('print("ok")', {
        fileId: 'main.py',
        executionId: 'exec-4',
        files: [],
      })
    ).to.throw('runtime unavailable')
  })

  it('terminates the worker even when destroy is called after loading failure', function () {
    const client = new PyodideWorkerClient({
      baseAssetPath: BASE_ASSET_PATH,
      createWorker,
      fileUploader: fileUploaderStub,
    })
    const worker = WorkerMock.instances[0]

    worker.emitMessage({
      type: 'loading-failed',
      error: 'runtime unavailable',
    })
    client.destroy()

    expect(worker.terminated).to.equal(true)
  })

  context('upload behavior', function () {
    const successResult = (name: string, relativePath: string) => ({
      status: 'success' as const,
      name,
      relativePath,
      data: { success: true },
    })
    const errorResult = (
      name: string,
      relativePath: string,
      error: string
    ) => ({
      status: 'error' as const,
      name,
      relativePath,
      error,
    })

    function emitRunResult(
      worker: WorkerMock,
      executionId: string,
      outputFiles: Array<{ relativePath: string; content: Uint8Array }>,
      success = true
    ) {
      worker.emitMessage({
        type: 'run-code-result',
        fileId: 'main.py',
        executionId,
        success,
        outputs: [],
        outputFiles,
        imports: [],
      })
    }

    const findFinished = (
      lifecycleEvents: Parameters<LifecycleCallback>[0][]
    ) => lifecycleEvents.find(e => e.type === 'run-finished')

    it('invokes fileUploader with mapped items when run-code-result has output files', async function () {
      const uploader = sinon
        .stub()
        .resolves([successResult('data.csv', 'output/data.csv')])
      const { worker, lifecycleEvents } = setupClientWithUploadTracking({
        fileUploader: uploader,
      })

      emitRunResult(worker, 'exec-up-1', [
        {
          relativePath: 'output/data.csv',
          content: new TextEncoder().encode('a,b\n1,2'),
        },
      ])
      await waitFor(() => Boolean(findFinished(lifecycleEvents)))

      expect(uploader.calledOnce).to.be.true
      const [items] = uploader.firstCall.args
      expect(items).to.have.lengthOf(1)
      expect(items[0].name).to.equal('data.csv')
      expect(items[0].relativePath).to.equal('output/data.csv')
      expect(items[0].file).to.be.instanceOf(Blob)
    })

    it('emits success: true and empty failedUploads when all uploads succeed', async function () {
      const uploader = sinon
        .stub()
        .resolves([
          successResult('a.csv', 'a.csv'),
          successResult('b.csv', 'b.csv'),
        ])
      const { worker, lifecycleEvents } = setupClientWithUploadTracking({
        fileUploader: uploader,
      })

      emitRunResult(worker, 'exec-up-2', [
        { relativePath: 'a.csv', content: new TextEncoder().encode('1') },
        { relativePath: 'b.csv', content: new TextEncoder().encode('2') },
      ])
      await waitFor(() => Boolean(findFinished(lifecycleEvents)))

      const finished = findFinished(lifecycleEvents)
      expect(finished).to.deep.include({ success: true, failedUploads: [] })
    })

    it('flips success to false and lists failed paths when an upload fails', async function () {
      const uploader = sinon
        .stub()
        .resolves([
          successResult('good.csv', 'good.csv'),
          errorResult('bad.csv', 'output/bad.csv', 'duplicate_file_name'),
        ])
      const { worker, lifecycleEvents, outputCalls } =
        setupClientWithUploadTracking({ fileUploader: uploader })

      emitRunResult(worker, 'exec-up-3', [
        { relativePath: 'good.csv', content: new TextEncoder().encode('1') },
        {
          relativePath: 'output/bad.csv',
          content: new TextEncoder().encode('2'),
        },
      ])
      await waitFor(() => Boolean(findFinished(lifecycleEvents)))

      const finished = findFinished(lifecycleEvents)
      expect(finished).to.deep.include({
        success: false,
        failedUploads: ['output/bad.csv'],
        errorType: 'UploadFileError',
      })

      // user-facing stderr line surfaced via outputCallback
      expect(outputCalls).to.have.lengthOf(1)
      const [stream, line] = outputCalls[0]
      expect(stream).to.equal('stderr')
      expect(line).to.include('output/bad.csv')
      expect(line).to.include('duplicate_file_name')
    })

    it('lists every file in failedUploads and surfaces a single stderr line when fileUploader rejects', async function () {
      const uploader = sinon.stub().rejects(new Error('network down'))
      const { worker, lifecycleEvents, outputCalls } =
        setupClientWithUploadTracking({ fileUploader: uploader })

      emitRunResult(worker, 'exec-up-4', [
        { relativePath: 'a.csv', content: new TextEncoder().encode('1') },
        { relativePath: 'b.csv', content: new TextEncoder().encode('2') },
      ])
      await waitFor(() => Boolean(findFinished(lifecycleEvents)))

      const finished = findFinished(lifecycleEvents)
      expect(finished).to.deep.include({
        success: false,
        errorType: 'UploadFileError',
      })
      expect(finished)
        .to.have.property('failedUploads')
        .that.has.members(['a.csv', 'b.csv'])

      expect(outputCalls).to.have.lengthOf(1)
      const [stream, line] = outputCalls[0]
      expect(stream).to.equal('stderr')
      expect(line).to.include('network down')
    })

    it('does not invoke fileUploader when run-code-result has success: false', async function () {
      const uploader = sinon.stub().resolves([])
      const { worker, lifecycleEvents } = setupClientWithUploadTracking({
        fileUploader: uploader,
      })

      emitRunResult(
        worker,
        'exec-up-5',
        [{ relativePath: 'a.csv', content: new TextEncoder().encode('1') }],
        false
      )
      await waitFor(() => Boolean(findFinished(lifecycleEvents)))

      expect(uploader.called).to.be.false
      expect(findFinished(lifecycleEvents)).to.deep.include({
        success: false,
        failedUploads: [],
      })
    })

    it('does not invoke fileUploader when outputFiles is empty', async function () {
      const uploader = sinon.stub().resolves([])
      const { worker, lifecycleEvents } = setupClientWithUploadTracking({
        fileUploader: uploader,
      })

      emitRunResult(worker, 'exec-up-6', [])
      await waitFor(() => Boolean(findFinished(lifecycleEvents)))

      expect(uploader.called).to.be.false
    })
  })

  describe('output-line forwarding', function () {
    function setupClientWithOutputTracking() {
      const outputCalls: Parameters<OutputCallback>[] = []
      const client = new PyodideWorkerClient({
        baseAssetPath: BASE_ASSET_PATH,
        createWorker,
        onOutput: (...args) => {
          outputCalls.push(args)
        },
        fileUploader: fileUploaderStub,
      })
      const worker = WorkerMock.instances[0]
      worker.emitMessage({ type: 'listening' })
      return { client, worker, outputCalls }
    }

    it('forwards stdout output-line events to the output callback', function () {
      const { worker, outputCalls } = setupClientWithOutputTracking()

      worker.emitMessage({
        type: 'output-line',
        stream: 'stdout',
        line: 'hello!',
        fileId: 'main.py',
        executionId: 'exec-stdout',
      })

      expect(outputCalls).to.deep.equal([
        ['stdout', 'hello!', 'main.py', 'exec-stdout'],
      ])
    })

    it('forwards stderr output-line events to the output callback', function () {
      const { worker, outputCalls } = setupClientWithOutputTracking()

      worker.emitMessage({
        type: 'output-line',
        stream: 'stderr',
        line: 'boom',
        fileId: 'main.py',
        executionId: 'exec-stderr',
      })

      expect(outputCalls).to.deep.equal([
        ['stderr', 'boom', 'main.py', 'exec-stderr'],
      ])
    })

    it('forwards info output-line events to the output callback', function () {
      const { worker, outputCalls } = setupClientWithOutputTracking()

      worker.emitMessage({
        type: 'output-line',
        stream: 'info',
        line: 'Loading numpy from package index',
        fileId: 'main.py',
        executionId: 'exec-info',
      })

      expect(outputCalls).to.deep.equal([
        ['info', 'Loading numpy from package index', 'main.py', 'exec-info'],
      ])
    })

    it('preserves stream type when forwarding stdout, stderr, and info in sequence', function () {
      const { worker, outputCalls } = setupClientWithOutputTracking()

      worker.emitMessage({
        type: 'output-line',
        stream: 'info',
        line: 'Loading package',
        fileId: 'main.py',
        executionId: 'exec-mixed',
      })
      worker.emitMessage({
        type: 'output-line',
        stream: 'stdout',
        line: 'result',
        fileId: 'main.py',
        executionId: 'exec-mixed',
      })
      worker.emitMessage({
        type: 'output-line',
        stream: 'stderr',
        line: 'warning',
        fileId: 'main.py',
        executionId: 'exec-mixed',
      })

      expect(outputCalls.map(call => call[0])).to.deep.equal([
        'info',
        'stdout',
        'stderr',
      ])
    })
  })

  describe('reset', function () {
    it('terminates the current worker and creates a new one', function () {
      const client = new PyodideWorkerClient({
        baseAssetPath: BASE_ASSET_PATH,
        createWorker,
        fileUploader: fileUploaderStub,
      })
      const originalWorker = WorkerMock.instances[0]
      originalWorker.emitMessage({ type: 'listening' })
      originalWorker.emitMessage({ type: 'loaded' })

      client.reset()

      expect(originalWorker.terminated).to.equal(true)
      expect(WorkerMock.instances).to.have.length(2)
    })

    it('sends init to the new worker once it reports listening after reset', function () {
      const client = new PyodideWorkerClient({
        baseAssetPath: BASE_ASSET_PATH,
        createWorker,
        fileUploader: fileUploaderStub,
      })
      const originalWorker = WorkerMock.instances[0]
      originalWorker.emitMessage({ type: 'listening' })
      originalWorker.emitMessage({ type: 'loaded' })

      client.reset()

      const newWorker = WorkerMock.instances[1]
      expect(newWorker.postedMessages).to.have.length(0)

      newWorker.emitMessage({ type: 'listening' })
      expect(newWorker.postedMessages).to.deep.equal([
        {
          type: 'init',
          baseAssetPath: BASE_ASSET_PATH,
        },
      ])
    })

    it('allows running code on the new worker after reset', function () {
      const client = new PyodideWorkerClient({
        baseAssetPath: BASE_ASSET_PATH,
        createWorker,
        fileUploader: fileUploaderStub,
      })
      const originalWorker = WorkerMock.instances[0]
      originalWorker.emitMessage({ type: 'listening' })
      originalWorker.emitMessage({ type: 'loaded' })

      client.reset()

      const newWorker = WorkerMock.instances[1]
      newWorker.emitMessage({ type: 'listening' })
      newWorker.emitMessage({ type: 'loaded' })

      client.runCode('print("after reset")', {
        fileId: 'main.py',
        executionId: 'exec-5',
        files: [],
      })

      const runRequest = newWorker.postedMessages.find(
        (message: any) => message.type === 'run-code'
      )
      expect(runRequest).to.include({
        type: 'run-code',
        fileId: 'main.py',
        executionId: 'exec-5',
        code: 'print("after reset")',
      })
    })

    it('reset is a no-op after destroy', function () {
      const client = new PyodideWorkerClient({
        baseAssetPath: BASE_ASSET_PATH,
        createWorker,
        fileUploader: fileUploaderStub,
      })
      const originalWorker = WorkerMock.instances[0]
      originalWorker.emitMessage({ type: 'listening' })
      originalWorker.emitMessage({ type: 'loaded' })

      client.destroy()
      client.reset()

      // No new worker should have been created
      expect(WorkerMock.instances).to.have.length(1)
    })
  })
})
