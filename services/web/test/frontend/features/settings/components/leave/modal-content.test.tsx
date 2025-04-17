import { expect } from 'chai'
import { screen, render } from '@testing-library/react'
import fetchMock from 'fetch-mock'

import LeaveModalContent from '../../../../../../frontend/js/features/settings/components/leave/modal-content'
import getMeta from '@/utils/meta'

describe('<LeaveModalContent />', function () {
  beforeEach(function () {
    Object.assign(getMeta('ol-ExposedSettings'), { isOverleaf: true })
    window.metaAttributesCache.set('ol-hasPassword', true)
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('disable delete button if form is not valid', function () {
    render(
      <LeaveModalContent
        handleHide={() => {}}
        inFlight={false}
        setInFlight={() => {}}
      />
    )
    screen.getByLabelText('Email')

    const deleteButton = screen.getByRole('button', {
      name: 'Delete',
    })
    expect(deleteButton.hasAttribute('disabled')).to.be.true
  })

  it('shows no password message', function () {
    window.metaAttributesCache.set('ol-isSaas', true)
    window.metaAttributesCache.set('ol-hasPassword', false)
    render(
      <LeaveModalContent
        handleHide={() => {}}
        inFlight={false}
        setInFlight={() => {}}
      />
    )

    const link = screen.getByRole('link', {
      name: 'Please use the password reset form to set a password before deleting your account',
    })
    expect(link.getAttribute('href')).to.equal('/user/password/reset')
  })
})
