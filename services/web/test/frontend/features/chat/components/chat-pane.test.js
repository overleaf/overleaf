import React from 'react'
import { expect } from 'chai'
import {
  fireEvent,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import fetchMock from 'fetch-mock'

import ChatPane from '../../../../../frontend/js/features/chat/components/chat-pane'
import {
  renderWithChatContext,
  cleanUpContext,
} from '../../../helpers/render-with-context'
import { stubMathJax, tearDownMathJaxStubs } from './stubs'

describe('<ChatPane />', function () {
  const user = {
    id: 'fake_user',
    first_name: 'fake_user_first_name',
    email: 'fake@example.com',
  }

  const testMessages = [
    {
      id: 'msg_1',
      content: 'a message',
      user,
      timestamp: new Date().getTime(),
    },
    {
      id: 'msg_2',
      content: 'another message',
      user,
      timestamp: new Date().getTime(),
    },
  ]

  beforeEach(function () {
    fetchMock.reset()
    cleanUpContext()

    stubMathJax()
  })

  afterEach(function () {
    tearDownMathJaxStubs()
  })

  it('renders multiple messages', async function () {
    fetchMock.get(/messages/, testMessages)

    renderWithChatContext(<ChatPane />, { user })

    await screen.findByText('a message')
    await screen.findByText('another message')
  })

  it('provides error message with reload button on FetchError', async function () {
    fetchMock.get(/messages/, 500)

    renderWithChatContext(<ChatPane />, { user })

    // should have hit a FetchError and will prompt user to reconnect
    await screen.findByText('Try again')

    // bring chat back up
    fetchMock.reset()
    fetchMock.get(/messages/, [])

    const reconnectButton = screen.getByRole('button', {
      name: 'Try again',
    })
    expect(reconnectButton).to.exist

    // should now reconnect with placeholder message
    fireEvent.click(reconnectButton)
    await screen.findByText('Send your first message to your collaborators')
  })

  it('a loading spinner is rendered while the messages are loading, then disappears', async function () {
    fetchMock.get(/messages/, [])

    renderWithChatContext(<ChatPane />, { user })

    await waitForElementToBeRemoved(() => screen.getByText('Loading…'))
  })

  describe('"send your first message" placeholder', function () {
    it('is rendered when there are no messages ', async function () {
      fetchMock.get(/messages/, [])

      renderWithChatContext(<ChatPane />, { user })

      await screen.findByText('Send your first message to your collaborators')
    })

    it('is not rendered when messages are displayed', function () {
      fetchMock.get(/messages/, testMessages)

      renderWithChatContext(<ChatPane />, { user })

      expect(
        screen.queryByText('Send your first message to your collaborators')
      ).to.not.exist
    })
  })
})
