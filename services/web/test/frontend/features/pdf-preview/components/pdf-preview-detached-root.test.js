import { expect } from 'chai'
import { render, screen, fireEvent } from '@testing-library/react'
import sysendTestHelper from '../../../helpers/sysend'
import PdfPreviewDetachedRoot from '../../../../../frontend/js/features/pdf-preview/components/pdf-preview-detached-root'

describe('<PdfPreviewDetachedRoot/>', function () {
  beforeEach(function () {
    const user = { id: 'user1' }
    window.user = user

    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-user', user)
    window.metaAttributesCache.set('ol-project_id', 'project1')
    window.metaAttributesCache.set('ol-detachRole', 'detached')
    window.metaAttributesCache.set('ol-projectName', 'Project Name')
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('syncs compiling state', async function () {
    render(<PdfPreviewDetachedRoot />)

    sysendTestHelper.receiveMessage({
      role: 'detacher',
      event: 'connected',
    })

    sysendTestHelper.receiveMessage({
      role: 'detacher',
      event: 'state-compiling',
      data: { value: true },
    })
    await screen.findByRole('button', { name: 'Compiling…' })
    expect(screen.queryByRole('button', { name: 'Recompile' })).to.not.exist

    sysendTestHelper.receiveMessage({
      role: 'detacher',
      event: 'state-compiling',
      data: { value: false },
    })
    await screen.findByRole('button', { name: 'Recompile' })
    expect(screen.queryByRole('button', { name: 'Compiling…' })).to.not.exist
  })

  it('sends a clear cache request when the button is pressed', async function () {
    render(<PdfPreviewDetachedRoot />)

    sysendTestHelper.receiveMessage({
      role: 'detacher',
      event: 'state-showLogs',
      data: { value: true },
    })

    const clearCacheButton = await screen.findByRole('button', {
      name: 'Clear cached files',
    })
    expect(clearCacheButton.hasAttribute('disabled')).to.be.false

    fireEvent.click(clearCacheButton)
    expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
      role: 'detached',
      event: 'action-clearCache',
      data: {
        args: [],
      },
    })
  })
})
