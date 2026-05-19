import { expect } from 'chai'
import sinon from 'sinon'
import {
  PythonRunner,
  PythonRunnerState,
  DEFAULT_STATE,
  ExecutionContext,
  type FileUploader,
} from '@/features/ide-react/components/editor/python/python-runner'
import { WorkerMock, createWorker } from './worker-mock'

const BASE_ASSET_PATH = 'https://assets.example.test/'
const FILE_ID = 'file-1'

function createRunner(
  overrides: {
    fileId?: string
    getExecutionContext?: () => Promise<ExecutionContext | null>
    fileUploader?: FileUploader
  } = {}
) {
  const fileId = overrides.fileId ?? FILE_ID
  const getExecutionContext =
    overrides.getExecutionContext ??
    (() =>
      Promise.resolve({
        code: 'print("hello")',
        files: [{ relativePath: 'main.py', content: 'print("hello")' }],
      }))

  const fileUploader = overrides.fileUploader ?? sinon.stub().resolves([])

  const runner = new PythonRunner(
    fileId,
    BASE_ASSET_PATH,
    getExecutionContext,
    createWorker,
    fileUploader
  )
  return runner
}

function initAndLoad(runner: PythonRunner) {
  runner.init()
  const worker = WorkerMock.instances[WorkerMock.instances.length - 1]
  worker.emitMessage({ type: 'listening' })
  worker.emitMessage({ type: 'loaded' })
  return worker
}

function waitForState(
  runner: PythonRunner,
  predicate: (state: PythonRunnerState) => boolean
): Promise<PythonRunnerState> {
  return new Promise(resolve => {
    if (predicate(runner.getState())) {
      resolve(runner.getState())
      return
    }
    const unsubscribe = runner.subscribe(() => {
      if (predicate(runner.getState())) {
        unsubscribe()
        resolve(runner.getState())
      }
    })
  })
}

describe('PythonRunner', function () {
  beforeEach(function () {
    WorkerMock.instances.length = 0
  })

  describe('initial state', function () {
    it('starts with default snapshot before init', function () {
      const runner = createRunner()
      expect(runner.getState()).to.deep.equal(DEFAULT_STATE)
    })
  })

  describe('init and lifecycle', function () {
    it('transitions to loading on init', function () {
      const runner = createRunner()
      runner.init()
      expect(runner.getState().status).to.equal('loading')
    })

    it('transitions to idle when worker reports loaded', function () {
      const runner = createRunner()
      initAndLoad(runner)
      expect(runner.getState().status).to.equal('idle')
    })

    it('transitions to errored on loading failure', function () {
      const runner = createRunner()
      runner.init()
      const worker = WorkerMock.instances[0]
      worker.emitMessage({ type: 'listening' })
      worker.emitMessage({
        type: 'loading-failed',
        error: 'network error',
      })
      expect(runner.getState().status).to.equal('errored')
      expect(runner.getState().error).to.equal('network error')
    })

    it('clears error on successful load after failure', function () {
      const runner = createRunner()
      runner.init()
      const worker = WorkerMock.instances[0]
      worker.emitMessage({ type: 'listening' })
      worker.emitMessage({ type: 'loaded' })
      expect(runner.getState().error).to.equal(null)
    })

    it('is a no-op if already initialized', function () {
      const runner = createRunner()
      runner.init()
      runner.init()
      expect(WorkerMock.instances).to.have.length(1)
    })
  })

  describe('run', function () {
    it('transitions to running then finished', async function () {
      const runner = createRunner()
      const worker = initAndLoad(runner)

      await runner.run()
      expect(runner.getState().status).to.equal('running')

      const runMsg = worker.postedMessages.find(m => m.type === 'run-code')
      worker.emitMessage({
        type: 'run-code-result',
        fileId: FILE_ID,
        executionId: runMsg.executionId,
        success: true,
        outputs: [],
        outputFiles: [],
        imports: [],
      })

      await waitForState(runner, s => s.status === 'finished')
      expect(runner.getState().status).to.equal('finished')
    })

    it('clears previous output on new run', async function () {
      const runner = createRunner()
      const worker = initAndLoad(runner)

      await runner.run()
      const runMsg = worker.postedMessages.find(m => m.type === 'run-code')
      worker.emitMessage({
        type: 'output-line',
        stream: 'stdout',
        line: 'first run output',
        fileId: FILE_ID,
        executionId: runMsg.executionId,
      })
      worker.emitMessage({
        type: 'run-code-result',
        fileId: FILE_ID,
        executionId: runMsg.executionId,
        success: true,
        outputs: [],
        outputFiles: [],
        imports: [],
      })
      expect(runner.getState().output).to.deep.equal([
        { stream: 'stdout', line: 'first run output' },
      ])

      await runner.run()
      expect(runner.getState().output).to.deep.equal([])
    })

    it('is a no-op while still loading', async function () {
      const runner = createRunner()
      runner.init()
      await runner.run()
      expect(runner.getState().status).to.equal('loading')
    })

    it('is a no-op when getExecutionContext returns null', async function () {
      const runner = createRunner({
        getExecutionContext: () => Promise.resolve(null),
      })
      initAndLoad(runner)

      await runner.run()
      expect(runner.getState().status).to.equal('idle')
    })

    it('transitions to errored when getExecutionContext rejects', async function () {
      const runner = createRunner({
        getExecutionContext: () => Promise.reject(new Error('network failure')),
      })
      initAndLoad(runner)

      await runner.run()
      expect(runner.getState().status).to.equal('errored')
      expect(runner.getState().error).to.equal('network failure')
    })
  })

  describe('files-saved toast', function () {
    let toastEvents: CustomEvent[]
    let toastListener: (event: Event) => void

    beforeEach(function () {
      toastEvents = []
      toastListener = event => {
        toastEvents.push(event as CustomEvent)
      }
      window.addEventListener('ide:show-toast', toastListener)
    })

    afterEach(function () {
      window.removeEventListener('ide:show-toast', toastListener)
    })

    it('dispatches a files-saved toast with successfully uploaded paths', async function () {
      const runner = createRunner()
      const worker = initAndLoad(runner)

      await runner.run()
      const runMsg = worker.postedMessages.find(m => m.type === 'run-code')
      worker.emitMessage({
        type: 'run-code-result',
        fileId: FILE_ID,
        executionId: runMsg.executionId,
        success: true,
        outputs: ['/project/foo.txt', '/project/bar.csv'],
        outputFiles: [],
        imports: [],
        failedUploads: [],
      })

      await waitForState(runner, s => s.status === 'finished')

      expect(toastEvents).to.have.length(1)
      expect(toastEvents[0].detail).to.deep.equal({
        key: 'python:files-saved',
        paths: ['foo.txt', 'bar.csv'],
      })
    })

    it('excludes failed uploads from the toast', async function () {
      const fileUploader = sinon.stub().resolves([
        { status: 'success', name: 'foo.txt', relativePath: 'foo.txt' },
        {
          status: 'error',
          name: 'bar.csv',
          relativePath: 'bar.csv',
          error: 'boom',
        },
      ])
      const runner = createRunner({ fileUploader })
      const worker = initAndLoad(runner)

      await runner.run()
      const runMsg = worker.postedMessages.find(m => m.type === 'run-code')
      worker.emitMessage({
        type: 'run-code-result',
        fileId: FILE_ID,
        executionId: runMsg.executionId,
        success: true,
        outputs: ['/project/foo.txt', '/project/bar.csv'],
        outputFiles: [
          { relativePath: 'foo.txt', content: new Uint8Array() },
          { relativePath: 'bar.csv', content: new Uint8Array() },
        ],
        imports: [],
      })

      await waitForState(runner, s => s.status === 'finished')

      expect(toastEvents).to.have.length(1)
      expect(toastEvents[0].detail).to.deep.equal({
        key: 'python:files-saved',
        paths: ['foo.txt'],
      })
    })

    it('does not dispatch a toast when no outputs were written', async function () {
      const runner = createRunner()
      const worker = initAndLoad(runner)

      await runner.run()
      const runMsg = worker.postedMessages.find(m => m.type === 'run-code')
      worker.emitMessage({
        type: 'run-code-result',
        fileId: FILE_ID,
        executionId: runMsg.executionId,
        success: true,
        outputs: [],
        outputFiles: [],
        imports: [],
        failedUploads: [],
      })

      await waitForState(runner, s => s.status === 'finished')

      expect(toastEvents).to.have.length(0)
    })

    it('does not dispatch a toast when every output failed to upload', async function () {
      const fileUploader = sinon.stub().resolves([
        {
          status: 'error',
          name: 'foo.txt',
          relativePath: 'foo.txt',
          error: 'boom',
        },
      ])
      const runner = createRunner({ fileUploader })
      const worker = initAndLoad(runner)

      await runner.run()
      const runMsg = worker.postedMessages.find(m => m.type === 'run-code')
      worker.emitMessage({
        type: 'run-code-result',
        fileId: FILE_ID,
        executionId: runMsg.executionId,
        success: true,
        outputs: ['/project/foo.txt'],
        outputFiles: [{ relativePath: 'foo.txt', content: new Uint8Array() }],
        imports: [],
      })

      await waitForState(runner, s => s.status === 'finished')

      expect(toastEvents).to.have.length(0)
    })
  })

  describe('output', function () {
    it('accumulates output lines for the matching file', async function () {
      const runner = createRunner()
      const worker = initAndLoad(runner)

      await runner.run()
      const runMsg = worker.postedMessages.find(m => m.type === 'run-code')

      worker.emitMessage({
        type: 'output-line',
        stream: 'stdout',
        line: 'line 1',
        fileId: FILE_ID,
        executionId: runMsg.executionId,
      })
      worker.emitMessage({
        type: 'output-line',
        stream: 'stderr',
        line: 'line 2',
        fileId: FILE_ID,
        executionId: runMsg.executionId,
      })

      expect(runner.getState().output).to.deep.equal([
        { stream: 'stdout', line: 'line 1' },
        { stream: 'stderr', line: 'line 2' },
      ])
    })

    it('ignores output for a different fileId', async function () {
      const runner = createRunner()
      const worker = initAndLoad(runner)

      await runner.run()
      const runMsg = worker.postedMessages.find(m => m.type === 'run-code')

      worker.emitMessage({
        type: 'output-line',
        stream: 'stdout',
        line: 'other file output',
        fileId: 'different-file',
        executionId: runMsg.executionId,
      })

      expect(runner.getState().output).to.deep.equal([])
    })

    it('ignores output for a stale executionId', async function () {
      const runner = createRunner()
      const worker = initAndLoad(runner)

      await runner.run()

      worker.emitMessage({
        type: 'output-line',
        stream: 'stdout',
        line: 'stale output',
        fileId: FILE_ID,
        executionId: 'old-execution-id',
      })

      expect(runner.getState().output).to.deep.equal([])
    })

    it('caps output at 100 lines', async function () {
      const runner = createRunner()
      const worker = initAndLoad(runner)

      await runner.run()
      const runMsg = worker.postedMessages.find(m => m.type === 'run-code')

      for (let i = 0; i < 110; i++) {
        worker.emitMessage({
          type: 'output-line',
          stream: 'stdout',
          line: `line ${i}`,
          fileId: FILE_ID,
          executionId: runMsg.executionId,
        })
      }

      const output = runner.getState().output
      expect(output).to.have.length(100)
      expect(output[0]).to.deep.equal({ stream: 'stdout', line: 'line 10' })
      expect(output[99]).to.deep.equal({ stream: 'stdout', line: 'line 109' })
    })
  })

  describe('interrupt', function () {
    it('appends interrupted message and transitions to loading when running', async function () {
      const runner = createRunner()
      const worker = initAndLoad(runner)

      await runner.run()
      const runMsg = worker.postedMessages.find(m => m.type === 'run-code')
      worker.emitMessage({
        type: 'output-line',
        stream: 'stdout',
        line: 'partial output',
        fileId: FILE_ID,
        executionId: runMsg.executionId,
      })

      runner.interrupt()

      expect(runner.getState().status).to.equal('loading')
      expect(runner.getState().output).to.deep.equal([
        { stream: 'stdout', line: 'partial output' },
        { stream: 'info', line: 'Execution interrupted' },
      ])
    })

    it('does not append interrupted message when not running', function () {
      const runner = createRunner()
      initAndLoad(runner)

      runner.interrupt()

      expect(runner.getState().status).to.equal('loading')
      expect(runner.getState().output).to.deep.equal([])
    })
  })

  describe('subscribe', function () {
    it('notifies listeners on state changes', function () {
      const runner = createRunner()
      const listener = sinon.stub()

      runner.subscribe(listener)
      initAndLoad(runner)

      expect(listener.callCount).to.be.greaterThan(0)
    })

    it('stops notifying after unsubscribe', function () {
      const runner = createRunner()
      const listener = sinon.stub()

      const unsubscribe = runner.subscribe(listener)
      runner.init()
      const countAfterInit = listener.callCount

      unsubscribe()
      const worker = WorkerMock.instances[0]
      worker.emitMessage({ type: 'listening' })
      worker.emitMessage({ type: 'loaded' })

      expect(listener.callCount).to.equal(countAfterInit)
    })
  })

  describe('destroy', function () {
    it('terminates the worker', function () {
      const runner = createRunner()
      initAndLoad(runner)

      runner.destroy()

      const worker = WorkerMock.instances[0]
      expect(worker.terminated).to.equal(true)
    })
  })
})
