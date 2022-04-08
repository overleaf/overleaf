import { expect } from 'chai'
import { screen, render } from '@testing-library/react'
import fetchMock from 'fetch-mock'

import LeaveModalContent from '../../../../../../frontend/js/features/settings/components/leave/modal-content'

describe('<LeaveModalContent />', function () {
  afterEach(function () {
    fetchMock.reset()
  })

  it('disable delete button if form is not valid', function () {
    render(
      <LeaveModalContent
        handleHide={() => {}}
        inFlight={false}
        setInFlight={() => {}}
      />
    )

    const deleteButton = screen.getByRole('button', {
      name: 'Delete',
    })
    expect(deleteButton.hasAttribute('disabled')).to.be.true
  })
})
