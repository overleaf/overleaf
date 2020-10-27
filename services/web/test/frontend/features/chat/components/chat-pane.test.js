import React from 'react'
import { expect } from 'chai'
import { screen, render } from '@testing-library/react'

import ChatPane from '../../../../../frontend/js/features/chat/components/chat-pane'
import {
  stubGlobalUser,
  stubMathJax,
  stubUIConfig,
  tearDownGlobalUserStub,
  tearDownMathJaxStubs,
  tearDownUIConfigStubs
} from './stubs'

describe('<ChatPane />', function() {
  const currentUser = {
    id: 'fake_user',
    first_name: 'fake_user_first_name',
    email: 'fake@example.com'
  }

  function createMessages() {
    return [
      {
        contents: ['a message'],
        user: currentUser,
        timestamp: new Date()
      },
      {
        contents: ['another message'],
        user: currentUser,
        timestamp: new Date()
      }
    ]
  }

  before(function() {
    stubGlobalUser(currentUser) // required by ColorManager
    stubUIConfig()
    stubMathJax()
  })

  after(function() {
    tearDownGlobalUserStub()
    tearDownUIConfigStubs()
    tearDownMathJaxStubs()
  })

  it('renders multiple messages', function() {
    render(
      <ChatPane
        loadMoreMessages={() => {}}
        sendMessage={() => {}}
        userId={currentUser.id}
        messages={createMessages()}
        resetUnreadMessages={() => {}}
      />
    )

    screen.getByText('a message')
    screen.getByText('another message')
  })

  describe('loading spinner', function() {
    it('is rendered while the messages is loading', function() {
      render(
        <ChatPane
          loading
          loadMoreMessages={() => {}}
          sendMessage={() => {}}
          userId={currentUser.id}
          messages={createMessages()}
          resetUnreadMessages={() => {}}
        />
      )
      screen.getByText('Loading…')
    })

    it('is not rendered when the messages are not loading', function() {
      render(
        <ChatPane
          loading={false}
          loadMoreMessages={() => {}}
          sendMessage={() => {}}
          userId={currentUser.id}
          messages={createMessages()}
          resetUnreadMessages={() => {}}
        />
      )
    })
    expect(screen.queryByText('Loading…')).to.not.exist
  })

  describe('"send your first message" placeholder', function() {
    it('is rendered when there are no messages ', function() {
      render(
        <ChatPane
          loadMoreMessages={() => {}}
          sendMessage={() => {}}
          userId={currentUser.id}
          messages={[]}
          resetUnreadMessages={() => {}}
        />
      )
      screen.getByText('Send your first message to your collaborators')
    })

    it('is not rendered when there are some messages', function() {
      render(
        <ChatPane
          loading={false}
          loadMoreMessages={() => {}}
          sendMessage={() => {}}
          userId={currentUser.id}
          messages={createMessages()}
          resetUnreadMessages={() => {}}
        />
      )
    })
    expect(screen.queryByText('Send your first message to your collaborators'))
      .to.not.exist
  })
})
