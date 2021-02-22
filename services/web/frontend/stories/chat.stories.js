import React from 'react'
import fetchMock from 'fetch-mock'
import { v4 as uuid } from 'uuid'

import { ContextRoot } from '../js/shared/context/root-context'
import ChatPane from '../js/features/chat/components/chat-pane'
import { stubMathJax } from '../../test/frontend/features/chat/components/stubs'
import { setupContext } from './fixtures/context'

const ONE_MINUTE = 60 * 1000

const user = {
  id: 'fake_user',
  first_name: 'mortimer',
  email: 'fake@example.com'
}

const user2 = {
  id: 'another_fake_user',
  first_name: 'leopold',
  email: 'another_fake@example.com'
}

function generateMessages(count) {
  const messages = []
  let timestamp = new Date().getTime() // newest message goes first
  for (let i = 0; i <= count; i++) {
    const author = Math.random() > 0.5 ? user : user2
    // modify the timestamp so the previous message has 70% chances to be within 5 minutes from
    // the current one, for grouping purposes
    timestamp -= (4.3 + Math.random()) * ONE_MINUTE

    messages.push({
      id: uuid(),
      content: `message #${i}`,
      user: author,
      timestamp
    })
  }
  return messages
}

stubMathJax()
setupContext()

export const Conversation = args => <ChatPane {...args} />
Conversation.parameters = {
  setupMocks: () => {
    fetchMock.restore()
    fetchMock.get(/messages/, generateMessages(35))
    fetchMock.post(/messages/, {})
  }
}

export const NoMessages = args => <ChatPane {...args} />
NoMessages.parameters = {
  setupMocks: () => {
    fetchMock.restore()
    fetchMock.get(/messages/, [])
  }
}

export const Loading = args => <ChatPane {...args} />
Loading.parameters = {
  setupMocks: () => {
    fetchMock.restore()
    fetchMock.get(/messages/, generateMessages(6), {
      delay: 1000 * 10
    })
  }
}

export default {
  title: 'Chat',
  component: ChatPane,
  argTypes: {
    resetUnreadMessages: { action: 'resetUnreadMessages' }
  },
  args: {
    resetUnreadMessages: () => {}
  },
  decorators: [
    (Story, { parameters: { setupMocks } }) => {
      if (setupMocks) setupMocks()
      return <Story />
    },
    Story => (
      <>
        <style>{'html, body, .chat { height: 100%; width: 100%; }'}</style>
        <ContextRoot
          chatIsOpenAngular
          setChatIsOpenAngular={() => {}}
          openDoc={() => {}}
          onlineUsersArray={[]}
        >
          <Story />
        </ContextRoot>
      </>
    )
  ]
}
