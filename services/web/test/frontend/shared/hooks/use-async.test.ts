import { renderHook, act } from '@testing-library/react'
import { expect } from 'chai'
import sinon from 'sinon'
import useAsync from '../../../../frontend/js/shared/hooks/use-async'
import { debugConsole } from '@/utils/debugging'

function deferred() {
  let res!: (
    value: Record<string, unknown> | PromiseLike<Record<string, unknown>>
  ) => void
  let rej!: (reason?: any) => void

  const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
    res = resolve
    rej = reject
  })

  return { promise, resolve: res, reject: rej }
}

const defaultState = {
  status: 'idle',
  data: null,
  error: null,

  isIdle: true,
  isLoading: false,
  isError: false,
  isSuccess: false,
}

const pendingState = {
  ...defaultState,
  status: 'pending',
  isIdle: false,
  isLoading: true,
}

const resolvedState = {
  ...defaultState,
  status: 'resolved',
  isIdle: false,
  isSuccess: true,
}

const rejectedState = {
  ...defaultState,
  status: 'rejected',
  isIdle: false,
  isError: true,
}

describe('useAsync', function () {
  let spyOnDebugConsoleError: sinon.SinonSpy
  beforeEach(function () {
    spyOnDebugConsoleError = sinon.spy(debugConsole, 'error')
  })

  afterEach(function () {
    spyOnDebugConsoleError.restore()
  })

  it('exposes the methods', function () {
    const { result } = renderHook(() => useAsync())

    expect(result.current.setData).to.be.a('function')
    expect(result.current.setError).to.be.a('function')
    expect(result.current.runAsync).to.be.a('function')
  })

  it('calling `runAsync` with a promise which resolves', async function () {
    const { promise, resolve } = deferred()
    const { result } = renderHook(() => useAsync())

    expect(result.current).to.include(defaultState)

    let p: Promise<unknown>
    act(() => {
      p = result.current.runAsync(promise)
    })

    expect(result.current).to.include(pendingState)

    const resolvedValue = {}
    await act(async () => {
      resolve(resolvedValue)
      await p
    })

    expect(result.current).to.include({
      ...resolvedState,
      data: resolvedValue,
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current).to.include(defaultState)
  })

  it('calling `runAsync` with a promise which rejects', async function () {
    const { promise, reject } = deferred()
    const { result } = renderHook(() => useAsync())

    expect(result.current).to.include(defaultState)

    let p: Promise<unknown>
    act(() => {
      p = result.current.runAsync(promise).catch(() => {})
    })

    expect(result.current).to.include(pendingState)

    const rejectedValue = Symbol('rejected value')
    await act(async () => {
      reject(rejectedValue)
      await p
    })

    expect(result.current).to.include({
      ...rejectedState,
      error: rejectedValue,
    })
  })

  it('can specify an initial state', function () {
    const mockData = Symbol('resolved value')
    const customInitialState = { status: 'resolved' as const, data: mockData }
    const { result } = renderHook(() => useAsync(customInitialState))

    expect(result.current).to.include({
      ...resolvedState,
      ...customInitialState,
    })
  })

  it('can set the data', function () {
    const mockData = Symbol('resolved value')
    const { result } = renderHook(() => useAsync())

    act(() => {
      result.current.setData(mockData)
    })

    expect(result.current).to.include({
      ...resolvedState,
      data: mockData,
    })
  })

  it('can set the error', function () {
    const mockError = new Error('rejected value')
    const { result } = renderHook(() => useAsync())

    act(() => {
      result.current.setError(mockError)
    })

    expect(result.current).to.include({
      ...rejectedState,
      error: mockError,
    })
  })

  it('no state updates happen if the component is unmounted while pending', async function () {
    const { promise, resolve } = deferred()
    const { result, unmount } = renderHook(() => useAsync())

    let p: Promise<unknown>
    act(() => {
      p = result.current.runAsync(promise)
    })
    unmount()
    await act(async () => {
      resolve({})
      await p
    })

    expect(debugConsole.error).not.to.have.been.called
  })
})
