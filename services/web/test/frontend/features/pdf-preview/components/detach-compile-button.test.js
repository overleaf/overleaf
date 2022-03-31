import DetachCompileButton from '../../../../../frontend/js/features/pdf-preview/components/detach-compile-button'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import { screen } from '@testing-library/react'
import sysendTestHelper from '../../../helpers/sysend'
import { expect } from 'chai'

describe('<DetachCompileButton/>', function () {
  afterEach(function () {
    window.metaAttributesCache = new Map()
    sysendTestHelper.resetHistory()
  })

  it('detacher mode and linked: show button ', async function () {
    window.metaAttributesCache.set('ol-detachRole', 'detacher')
    renderWithEditorContext(<DetachCompileButton />)
    sysendTestHelper.receiveMessage({
      role: 'detached',
      event: 'connected',
    })

    await screen.getByRole('button', {
      name: 'Recompile',
    })
  })

  it('detacher mode and not linked: does not show button ', async function () {
    window.metaAttributesCache.set('ol-detachRole', 'detacher')
    renderWithEditorContext(<DetachCompileButton />)

    expect(
      await screen.queryByRole('button', {
        name: 'Recompile',
      })
    ).to.not.exist
  })

  it('not detacher mode and linked: does not show button ', async function () {
    window.metaAttributesCache.set('ol-detachRole', 'detached')
    renderWithEditorContext(<DetachCompileButton />)
    sysendTestHelper.receiveMessage({
      role: 'detacher',
      event: 'connected',
    })

    expect(
      await screen.queryByRole('button', {
        name: 'Recompile',
      })
    ).to.not.exist
  })
})
