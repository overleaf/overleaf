import sinon from 'sinon'
import { expect } from 'chai'
import { renderHookWithEditorContext } from '../../helpers/render-with-context'
import sysendTestHelper from '../../helpers/sysend'
import useDetachAction from '../../../../frontend/js/shared/hooks/use-detach-action'

const actionName = 'some-action'
const actionFunction = sinon.stub()

describe('useDetachAction', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    actionFunction.reset()
  })

  it('broadcast message as sender', async function () {
    window.metaAttributesCache.set('ol-detachRole', 'detacher')
    const { result } = renderHookWithEditorContext(() =>
      useDetachAction(actionName, actionFunction, 'detacher', 'detached')
    )
    const triggerFn = result.current
    sysendTestHelper.resetHistory()

    triggerFn('param')

    expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
      role: 'detacher',
      event: `action-${actionName}`,
      data: { args: ['param'] },
    })

    sinon.assert.notCalled(actionFunction)
  })

  it('call function as non-sender', async function () {
    const { result } = renderHookWithEditorContext(() =>
      useDetachAction(actionName, actionFunction, 'detacher', 'detached')
    )
    const triggerFn = result.current
    sysendTestHelper.resetHistory()

    triggerFn('param')

    expect(sysendTestHelper.getDetachCalls('broadcast').length).to.equal(0)

    sinon.assert.calledWith(actionFunction, 'param')
  })

  it('receive message and call function as target', async function () {
    window.metaAttributesCache.set('ol-detachRole', 'detached')
    renderHookWithEditorContext(() =>
      useDetachAction(actionName, actionFunction, 'detacher', 'detached')
    )

    sysendTestHelper.receiveMessage({
      role: 'detached',
      event: `action-${actionName}`,
      data: { args: ['param'] },
    })

    sinon.assert.calledWith(actionFunction, 'param')
  })

  it('receive message and does not call function as non-target', async function () {
    window.metaAttributesCache.set('ol-detachRole', 'detacher')
    renderHookWithEditorContext(() =>
      useDetachAction(actionName, actionFunction, 'detacher', 'detached')
    )

    sysendTestHelper.receiveMessage({
      role: 'detached',
      event: `action-${actionName}`,
      data: { args: [] },
    })

    sinon.assert.notCalled(actionFunction)
  })
})
