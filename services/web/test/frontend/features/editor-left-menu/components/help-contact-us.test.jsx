import { expect } from 'chai'
import { screen, fireEvent, within } from '@testing-library/react'
import HelpContactUs from '../../../../../frontend/js/features/editor-left-menu/components/help-contact-us'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import fetchMock from 'fetch-mock'

describe('<HelpContactUs />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-user', {
      email: 'sherlock@holmes.co.uk',
      first_name: 'Sherlock',
      last_name: 'Holmes',
    })
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('open contact us modal when clicked', function () {
    renderWithEditorContext(<HelpContactUs />)

    expect(screen.queryByRole('dialog')).to.equal(null)
    fireEvent.click(screen.getByRole('button', { name: 'Contact us' }))
    const modal = screen.getAllByRole('dialog')[0]
    within(modal).getAllByText('Get in touch')
    within(modal).getByText('Subject')
  })
})
