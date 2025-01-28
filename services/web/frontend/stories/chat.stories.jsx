import ChatPane from '../js/features/chat/components/chat-pane'
import useFetchMock from './hooks/use-fetch-mock'
import { generateMessages } from './fixtures/chat-messages'
import { ScopeDecorator } from './decorators/scope'
import { bsVersionDecorator } from '../../.storybook/utils/with-bootstrap-switcher'
import { UserProvider } from '@/shared/context/user-context'

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

export const LoadingError = args => {
  useFetchMock(fetchMock => {
    fetchMock.get(/messages/, 500)
  })

  return <ChatPane {...args} />
}

export default {
  title: 'Editor / Chat',
  component: ChatPane,
  argTypes: {
    resetUnreadMessages: { action: 'resetUnreadMessages' },
    ...bsVersionDecorator.argTypes,
  },
  args: {
    resetUnreadMessages: () => {},
  },
  decorators: [
    ScopeDecorator,
    Story => (
      <UserProvider>
        <Story />
      </UserProvider>
    ),
  ],
}
