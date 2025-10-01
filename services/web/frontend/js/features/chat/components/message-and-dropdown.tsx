import {
  Message as MessageType,
  useChatContext,
} from '@/features/chat/context/chat-context'
import classNames from 'classnames'
import MessageDropdown from '@/features/chat/components/message-dropdown'
import MessageContent from '@/features/chat/components/message-content'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export function MessageAndDropdown({
  message,
  fromSelf,
}: {
  message: MessageType
  fromSelf: boolean
}) {
  const { idOfMessageBeingEdited } = useChatContext()
  const hasChatEditDelete = useFeatureFlag('chat-edit-delete')

  const editing = idOfMessageBeingEdited === message.id

  return (
    <div
      className={classNames('message-and-dropdown', {
        'pending-message': message.pending,
      })}
    >
      {hasChatEditDelete && fromSelf && !message.pending && !editing ? (
        <MessageDropdown message={message} />
      ) : null}
      <div className="message-content">
        <MessageContent
          content={message.content}
          messageId={message.id}
          edited={message.edited}
        />
      </div>
    </div>
  )
}
