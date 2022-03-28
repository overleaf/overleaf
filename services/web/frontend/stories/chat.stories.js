import { v4 as uuid } from 'uuid'

import { ContextRoot } from '../js/shared/context/root-context'
import ChatPane from '../js/features/chat/components/chat-pane'
import { stubMathJax } from '../../test/frontend/features/chat/components/stubs'
import { setupContext } from './fixtures/context'
import useFetchMock from './hooks/use-fetch-mock'

const ONE_MINUTE = 60 * 1000

const user = {
  id: 'fake_user',
  first_name: 'mortimer',
  email: 'fake@example.com',
}

const user2 = {
  id: 'another_fake_user',
  first_name: 'leopold',
  email: 'another_fake@example.com',
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
      timestamp,
    })
  }
  return messages
}

stubMathJax()
setupContext()

export const Conversation = args => {
  useFetchMock(fetchMock => {
    fetchMock.get(/messages/, generateMessages(35)).post(/messages/, {})
  })

  return <ChatPane {...args} />
}

export const NoMessages = args => {
  useFetchMock(fetchMock => {
    fetchMock.get(/messages/, [])
  })

  return <ChatPane {...args} />
}

export const Loading = args => {
  useFetchMock(fetchMock => {
    fetchMock.get(/messages/, generateMessages(6), {
      delay: 1000 * 10,
    })
  })

  return <ChatPane {...args} />
}

export default {
  title: 'Editor / Chat',
  component: ChatPane,
  argTypes: {
    resetUnreadMessages: { action: 'resetUnreadMessages' },
  },
  args: {
    resetUnreadMessages: () => {},
  },
  decorators: [
    Story => (
      <>
        <style>{'html, body, .chat { height: 100%; width: 100%; }'}</style>
        <ContextRoot ide={window._ide} settings={{}}>
          <Story />
        </ContextRoot>
      </>
    ),
  ],
}
