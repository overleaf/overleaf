import React from 'react'
import { expect } from 'chai'
import {
  render,
  screen,
  waitForElementToBeRemoved
} from '@testing-library/react'
import fetchMock from 'fetch-mock'

import ChatPane from '../../../../../frontend/js/features/chat/components/chat-pane'
import {
  stubChatStore,
  stubMathJax,
  stubUIConfig,
  tearDownChatStore,
  tearDownMathJaxStubs,
  tearDownUIConfigStubs
} from './stubs'

describe('<ChatPane />', function() {
  const currentUser = {
    id: 'fake_user',
    first_name: 'fake_user_first_name',
    email: 'fake@example.com'
  }

  const testMessages = [
    {
      content: 'a message',
      user: currentUser,
      timestamp: new Date().getTime()
    },
    {
      content: 'another message',
      user: currentUser,
      timestamp: new Date().getTime()
    }
  ]

  beforeEach(function() {
    stubChatStore({ user: currentUser })
    stubUIConfig()
    stubMathJax()
    fetchMock.reset()
  })

  afterEach(function() {
    tearDownChatStore()
    tearDownUIConfigStubs()
    tearDownMathJaxStubs()
    fetchMock.reset()
  })

  it('renders multiple messages', async function() {
    fetchMock.get(/messages/, testMessages)
    render(<ChatPane resetUnreadMessages={() => {}} />)

    await screen.findByText('a message')
    await screen.findByText('another message')
  })

  it('A loading spinner is rendered while the messages are loading, then disappears', async function() {
    fetchMock.get(/messages/, [])
    render(<ChatPane resetUnreadMessages={() => {}} />)
    await waitForElementToBeRemoved(() => screen.getByText('Loading…'))
  })

  describe('"send your first message" placeholder', function() {
    it('is rendered when there are no messages ', async function() {
      fetchMock.get(/messages/, [])
      render(<ChatPane resetUnreadMessages={() => {}} />)
      await screen.findByText('Send your first message to your collaborators')
    })

    it('is not rendered when messages are displayed', function() {
      fetchMock.get(/messages/, testMessages)
      render(<ChatPane resetUnreadMessages={() => {}} />)
      expect(
        screen.queryByText('Send your first message to your collaborators')
      ).to.not.exist
    })
  })
})
