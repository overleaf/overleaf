import { RailIndicator } from '@/features/ide-react/components/rail/rail-indicator'
import { useChatContext } from '@/features/chat/context/chat-context'

export const ChatIndicator = () => {
  const { unreadMessageCount } = useChatContext()
  if (unreadMessageCount === 0) {
    return null
  }
  return <RailIndicator count={unreadMessageCount} type="info" />
}

export default ChatIndicator
