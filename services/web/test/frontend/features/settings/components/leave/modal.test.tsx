import sinon from 'sinon'
import { fireEvent, screen, render, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'

import LeaveModal from '../../../../../../frontend/js/features/settings/components/leave/modal'
import getMeta from '@/utils/meta'

describe('<LeaveModal />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-usersEmail', 'foo@bar.com')
    Object.assign(getMeta('ol-ExposedSettings'), { isOverleaf: true })
    window.metaAttributesCache.set('ol-hasPassword', true)
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('closes modal on cancel', async function () {
    const handleClose = sinon.stub()
    render(<LeaveModal isOpen handleClose={handleClose} />)

    const cancelButton = screen.getByRole('button', {
      name: 'Cancel',
    })
    fireEvent.click(cancelButton)

    sinon.assert.calledOnce(handleClose)
  })

  it('does not close modal while in flight', async function () {
    fetchMock.post('/user/delete', new Promise(() => {}))
    const handleClose = sinon.stub()
    render(<LeaveModal isOpen handleClose={handleClose} />)

    fillValidForm()

    const deleteButton = screen.getByRole('button', {
      name: 'Delete',
    })
    fireEvent.click(deleteButton)

    await waitFor(() => {
      screen.getByRole('button', {
        name: 'Deleting…',
      })
    })

    const cancelButton = screen.getByRole('button', {
      name: 'Cancel',
    })
    fireEvent.click(cancelButton)

    sinon.assert.notCalled(handleClose)
  })
})

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'foo@bar.com' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'foobar' },
  })
  fireEvent.click(screen.getByLabelText(/I understand/))
}
