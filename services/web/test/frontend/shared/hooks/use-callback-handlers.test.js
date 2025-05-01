import sinon from 'sinon'
import { renderHook } from '@testing-library/react'
import useCallbackHandlers from '../../../../frontend/js/shared/hooks/use-callback-handlers'

describe('useCallbackHandlers', function () {
  it('adds, removes and calls all handlers without duplicate', async function () {
    const handler1 = sinon.stub()
    const handler2 = sinon.stub()
    const handler3 = sinon.stub()

    const { result } = renderHook(() => useCallbackHandlers())

    result.current.addHandler(handler1)
    result.current.deleteHandler(handler1)
    result.current.addHandler(handler1)

    result.current.addHandler(handler2)
    result.current.deleteHandler(handler2)

    result.current.addHandler(handler3)
    result.current.addHandler(handler3)

    result.current.callHandlers('foo')
    result.current.callHandlers(1337)

    sinon.assert.calledTwice(handler1)
    sinon.assert.calledWith(handler1, 'foo')
    sinon.assert.calledWith(handler1, 1337)

    sinon.assert.notCalled(handler2)

    sinon.assert.calledTwice(handler3)
  })
})
