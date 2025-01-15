import { expect } from 'chai'
import sinon from 'sinon'

import customLocalStorage from '@/infrastructure/local-storage'
import { debugConsole } from '@/utils/debugging'

describe('localStorage', function () {
  let originalLocalStorage
  before(function () {
    originalLocalStorage = global.localStorage
  })

  after(function () {
    Object.defineProperty(global, 'localStorage', {
      value: originalLocalStorage,
    })
  })

  let spyOnDebugConsoleError
  beforeEach(function () {
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: sinon.stub().returns(null),
        setItem: sinon.stub(),
        clear: sinon.stub(),
        removeItem: sinon.stub(),
      },
    })

    spyOnDebugConsoleError = sinon.spy(debugConsole, 'error')
  })

  afterEach(function () {
    spyOnDebugConsoleError.restore()
    Object.defineProperty(global, 'localStorage', { value: undefined })
  })

  it('getItem', function () {
    expect(customLocalStorage.getItem('foo')).to.be.null

    global.localStorage.getItem.returns('false')
    expect(customLocalStorage.getItem('foo')).to.equal(false)

    global.localStorage.getItem.returns('{"foo":"bar"}')
    expect(customLocalStorage.getItem('foo')).to.deep.equal({ foo: 'bar' })

    global.localStorage.getItem.throws(new Error('Nope'))
    expect(customLocalStorage.getItem('foo')).to.be.null
    expect(debugConsole.error).to.be.calledOnce
  })

  it('setItem', function () {
    customLocalStorage.setItem('foo', 'bar')
    expect(global.localStorage.setItem).to.be.calledOnceWith('foo', '"bar"')
    global.localStorage.setItem.reset()

    customLocalStorage.setItem('foo', true)
    expect(global.localStorage.setItem).to.be.calledOnceWith('foo', 'true')
    global.localStorage.setItem.reset()

    customLocalStorage.setItem('foo', { bar: 1 })
    expect(global.localStorage.setItem).to.be.calledOnceWith('foo', '{"bar":1}')
    global.localStorage.setItem.reset()

    global.localStorage.setItem.throws(new Error('Nope'))
    expect(customLocalStorage.setItem('foo', 'bar')).to.be.null
    expect(debugConsole.error).to.be.calledOnce
  })

  it('clear', function () {
    customLocalStorage.clear()
    expect(global.localStorage.clear).to.be.calledOnce

    global.localStorage.clear.throws(new Error('Nope'))
    expect(customLocalStorage.clear()).to.be.null
    expect(debugConsole.error).to.be.calledOnce
  })

  it('removeItem', function () {
    customLocalStorage.removeItem('foo')
    expect(global.localStorage.removeItem).to.be.calledOnceWith('foo')
    global.localStorage.removeItem.reset()

    global.localStorage.removeItem.throws(new Error('Nope'))
    expect(customLocalStorage.removeItem('foo')).to.be.null
    expect(debugConsole.error).to.be.calledOnce
  })
})
