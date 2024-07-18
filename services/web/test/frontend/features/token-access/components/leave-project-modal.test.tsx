import { expect } from 'chai'
import sinon from 'sinon'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeaveProjectModal from '@/features/token-access/components/leave-project-modal'

describe('<LeaveProjectModal/>', function () {
  const closeHandler = sinon.stub()
  const leaveHandler = sinon.stub()
  it('does not render when no show prop is passed', function () {
    render(
      <LeaveProjectModal
        handleCloseModal={closeHandler}
        handleLeaveAction={leaveHandler}
        showModal={false}
      />
    )
    const leaveText = screen.queryByText('Leave Project')
    expect(leaveText).to.be.null
  })

  it('renders when the show prop is passed', function () {
    render(
      <LeaveProjectModal
        handleCloseModal={closeHandler}
        handleLeaveAction={leaveHandler}
        showModal
      />
    )
    const leaveText = screen.queryByText('Leave Project')
    expect(leaveText).to.exist
  })

  it('calls the close handler when dismissed', async function () {
    const user = userEvent.setup()
    render(
      <LeaveProjectModal
        handleCloseModal={closeHandler}
        handleLeaveAction={leaveHandler}
        showModal
      />
    )
    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(closeHandler).to.have.been.calledOnce
  })

  it('calls the leave handler when confirmed', async function () {
    const user = userEvent.setup()
    render(
      <LeaveProjectModal
        handleCloseModal={closeHandler}
        handleLeaveAction={leaveHandler}
        showModal
      />
    )
    await user.click(screen.getByRole('button', { name: /Confirm/i }))
    expect(leaveHandler).to.have.been.calledOnce
  })
})
