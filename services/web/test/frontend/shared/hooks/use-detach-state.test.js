import { act } from '@testing-library/react-hooks'
import { expect } from 'chai'
import { renderHookWithEditorContext } from '../../helpers/render-with-context'
import sysendTestHelper from '../../helpers/sysend'
import useDetachState from '../../../../frontend/js/shared/hooks/use-detach-state'

const stateKey = 'some-key'

describe('useDetachState', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('create and update state', async function () {
    const defaultValue = 'foobar'
    const { result } = renderHookWithEditorContext(() =>
      useDetachState(stateKey, defaultValue)
    )
    const [value, setValue] = result.current
    expect(value).to.equal(defaultValue)
    expect(setValue).to.be.a('function')

    const newValue = 'barbaz'
    act(() => {
      setValue(newValue)
    })
    expect(result.current[0]).to.equal(newValue)
  })

  it('broadcast message as sender', async function () {
    window.metaAttributesCache.set('ol-detachRole', 'detacher')
    const { result } = renderHookWithEditorContext(() =>
      useDetachState(stateKey, null, 'detacher', 'detached')
    )
    const [, setValue] = result.current
    sysendTestHelper.resetHistory()

    const newValue = 'barbaz'
    act(() => {
      setValue(newValue)
    })
    expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
      role: 'detacher',
      event: `state-${stateKey}`,
      data: { value: newValue },
    })
  })

  it('receive message as target', async function () {
    window.metaAttributesCache.set('ol-detachRole', 'detached')
    const { result } = renderHookWithEditorContext(() =>
      useDetachState(stateKey, null, 'detacher', 'detached')
    )

    const newValue = 'barbaz'
    sysendTestHelper.receiveMessage({
      role: 'detached',
      event: `state-${stateKey}`,
      data: { value: newValue },
    })

    expect(result.current[0]).to.equal(newValue)
  })
})
