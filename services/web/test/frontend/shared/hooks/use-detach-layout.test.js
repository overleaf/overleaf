import { waitFor } from '@testing-library/react'
import { act } from '@testing-library/react-hooks'
import { expect } from 'chai'
import sinon from 'sinon'
import { renderHookWithEditorContext } from '../../helpers/render-with-context'
import sysendTestHelper from '../../helpers/sysend'
import useDetachLayout from '../../../../frontend/js/shared/hooks/use-detach-layout'

describe('useDetachLayout', function () {
  let openStub
  let closeStub

  beforeEach(function () {
    window.metaAttributesCache = new Map()
    openStub = sinon.stub(window, 'open')
    closeStub = sinon.stub(window, 'close')
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    openStub.restore()
    closeStub.restore()
  })

  it('detaching', async function () {
    // 1. create hook in normal mode
    const { result } = renderHookWithEditorContext(() => useDetachLayout())
    expect(result.current.reattach).to.be.a('function')
    expect(result.current.detach).to.be.a('function')
    expect(result.current.isLinked).to.be.false
    expect(result.current.isLinking).to.be.false
    expect(result.current.role).to.be.null

    // 2. detach
    act(() => {
      result.current.detach()
    })
    expect(result.current.isLinked).to.be.false
    expect(result.current.isLinking).to.be.true
    expect(result.current.role).to.equal('detacher')
    sinon.assert.calledOnce(openStub)
    sinon.assert.calledWith(
      openStub,
      'https://www.test-overleaf.com/detached',
      '_blank'
    )
  })

  it('detacher role', async function () {
    sysendTestHelper.spy.broadcast.resetHistory()
    window.metaAttributesCache.set('ol-detachRole', 'detacher')

    // 1. create hook in detacher mode
    const { result } = renderHookWithEditorContext(() => useDetachLayout())
    expect(result.current.reattach).to.be.a('function')
    expect(result.current.detach).to.be.a('function')
    expect(result.current.isLinked).to.be.false
    expect(result.current.isLinking).to.be.false
    expect(result.current.role).to.equal('detacher')
    const broadcastMessagesCount =
      sysendTestHelper.getAllBroacastMessages().length

    // 2. simulate connected detached tab
    sysendTestHelper.spy.broadcast.resetHistory()
    sysendTestHelper.receiveMessage({
      role: 'detached',
      event: 'connected',
    })
    expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
      role: 'detacher',
      event: 'up',
    })
    expect(result.current.isLinked).to.be.true
    expect(result.current.isLinking).to.be.false
    expect(result.current.role).to.equal('detacher')

    // check that all message were re-broadcast for the new tab
    await nextTick() // necessary to ensure all event handler have run
    await waitFor(() => {
      const reBroadcastMessagesCount =
        sysendTestHelper.getAllBroacastMessages().length
      expect(reBroadcastMessagesCount).to.equal(broadcastMessagesCount)
    })
    // 3. simulate closed detached tab
    sysendTestHelper.spy.broadcast.resetHistory()
    sysendTestHelper.receiveMessage({
      role: 'detached',
      event: 'closed',
    })
    expect(result.current.isLinked).to.be.false
    expect(result.current.isLinking).to.be.false
    expect(result.current.role).to.equal('detacher')

    // 4. simulate up detached tab
    sysendTestHelper.spy.broadcast.resetHistory()
    sysendTestHelper.receiveMessage({
      role: 'detached',
      event: 'up',
    })
    expect(result.current.isLinked).to.be.true
    expect(result.current.isLinking).to.be.false
    expect(result.current.role).to.equal('detacher')

    // 5. reattach
    sysendTestHelper.spy.broadcast.resetHistory()
    act(() => {
      result.current.reattach()
    })
    expect(result.current.isLinked).to.be.false
    expect(result.current.isLinking).to.be.false
    expect(result.current.role).to.be.null
    expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
      role: 'detacher',
      event: 'reattach',
    })
  })

  it('reset detacher role when other detacher tab connects', function () {
    window.metaAttributesCache.set('ol-detachRole', 'detacher')

    // 1. create hook in detacher mode
    const { result } = renderHookWithEditorContext(() => useDetachLayout())
    expect(result.current.reattach).to.be.a('function')
    expect(result.current.detach).to.be.a('function')
    expect(result.current.isLinked).to.be.false
    expect(result.current.isLinking).to.be.false
    expect(result.current.role).to.equal('detacher')

    // 2. simulate other detacher tab
    sysendTestHelper.receiveMessage({
      role: 'detacher',
      event: 'up',
    })
    expect(result.current.isRedundant).to.be.true
    expect(result.current.role).to.equal(null)
  })

  it('detached role', async function () {
    window.metaAttributesCache.set('ol-detachRole', 'detached')

    // 1. create hook in detached mode
    const { result } = renderHookWithEditorContext(() => useDetachLayout())
    expect(result.current.reattach).to.be.a('function')
    expect(result.current.detach).to.be.a('function')
    expect(result.current.isLinked).to.be.false
    expect(result.current.isLinking).to.be.false
    expect(result.current.role).to.equal('detached')

    // 2. simulate up detacher tab
    sysendTestHelper.spy.broadcast.resetHistory()
    sysendTestHelper.receiveMessage({
      role: 'detacher',
      event: 'up',
    })
    expect(result.current.isLinked).to.be.true
    expect(result.current.isLinking).to.be.false
    expect(result.current.role).to.equal('detached')

    // 3. simulate closed detacher tab
    sysendTestHelper.spy.broadcast.resetHistory()
    sysendTestHelper.receiveMessage({
      role: 'detacher',
      event: 'closed',
    })
    expect(result.current.isLinked).to.be.false
    expect(result.current.isLinking).to.be.false
    expect(result.current.role).to.equal('detached')

    // 4. simulate up detacher tab
    sysendTestHelper.spy.broadcast.resetHistory()
    sysendTestHelper.receiveMessage({
      role: 'detacher',
      event: 'up',
    })
    expect(result.current.isLinked).to.be.true
    expect(result.current.isLinking).to.be.false
    expect(result.current.role).to.equal('detached')

    // 5. simulate closed detached tab
    sysendTestHelper.spy.broadcast.resetHistory()
    sysendTestHelper.receiveMessage({
      role: 'detached',
      event: 'closed',
    })
    expect(result.current.isLinked).to.be.true
    expect(result.current.isLinking).to.be.false
    expect(result.current.role).to.equal('detached')
    expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
      role: 'detached',
      event: 'up',
    })

    // 6. simulate reattach event
    sysendTestHelper.spy.broadcast.resetHistory()
    sysendTestHelper.receiveMessage({
      role: 'detacher',
      event: 'reattach',
    })
    expect(result.current.isLinked).to.be.false
    expect(result.current.isLinking).to.be.false
    expect(result.current.role).to.equal('detached')
    sinon.assert.called(closeStub)
  })
})

const nextTick = () => {
  return new Promise(resolve => {
    setTimeout(resolve)
  })
}
