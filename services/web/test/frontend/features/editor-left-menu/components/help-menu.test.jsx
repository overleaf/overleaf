import { screen } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import HelpMenu from '../../../../../frontend/js/features/editor-left-menu/components/help-menu'
import { renderWithEditorContext } from '../../../helpers/render-with-context'

describe('<HelpMenu />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-user', {
      email: 'sherlock@holmes.co.uk',
      first_name: 'Sherlock',
      last_name: 'Holmes',
    })
  })

  afterEach(function () {
    fetchMock.reset()
  })

  it('shows correct menu if `showSupport` is `true`', function () {
    window.metaAttributesCache.set('ol-showSupport', true)

    renderWithEditorContext(<HelpMenu />)

    screen.getByRole('button', { name: 'Show Hotkeys' })
    screen.getByRole('button', { name: 'Contact Us' })
    screen.getByRole('link', { name: 'Documentation' })
  })

  it('shows correct menu if `showSupport` is `false`', function () {
    window.metaAttributesCache.set('ol-showSupport', false)

    renderWithEditorContext(<HelpMenu />)

    screen.getByRole('button', { name: 'Show Hotkeys' })
    expect(screen.queryByRole('button', { name: 'Contact Us' })).to.equal(null)
    expect(screen.queryByRole('link', { name: 'Documentation' })).to.equal(null)
  })
})
