import { expect } from 'chai'
import { screen, render } from '@testing-library/react'
import Notification from '../../../../frontend/js/shared/components/notification'
import * as eventTracking from '@/infrastructure/event-tracking'
import sinon from 'sinon'

describe('<Notification />', function () {
  let sendMBSpy: sinon.SinonSpy

  beforeEach(function () {
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
  })

  afterEach(function () {
    sendMBSpy.restore()
  })

  it('renders and is not dismissible by default', function () {
    render(<Notification type="info" content={<p>A notification</p>} />)
    screen.getByText('A notification')
    expect(screen.queryByRole('button', { name: 'Close' })).to.be.null
  })

  it('renders with action', function () {
    render(
      <Notification
        type="info"
        content={<p>A notification</p>}
        action={<a href="/">Action</a>}
      />
    )
    screen.getByText('A notification')
    screen.getByRole('link', { name: 'Action' })
  })

  it('renders with close button', function () {
    render(
      <Notification type="info" content={<p>A notification</p>} isDismissible />
    )
    screen.getByText('A notification')
    screen.getByRole('button', { name: 'Close' })
  })

  it('renders with title and content passed as HTML', function () {
    render(
      <Notification
        type="info"
        content={<p>A notification</p>}
        title="A title"
      />
    )
    screen.getByText('A title')
    screen.getByText('A notification')
  })

  it('renders with content when passed as a string', function () {
    render(
      <Notification type="info" content="A notification" title="A title" />
    )
    screen.getByText('A notification')
  })
})
