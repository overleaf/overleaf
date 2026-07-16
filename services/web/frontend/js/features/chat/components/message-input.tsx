import { useTranslation } from 'react-i18next'
import { useCallback, useRef } from 'react'
import {
  MentionsInput,
  MentionsInputHandle,
} from '@/shared/components/mentions-input'

type MessageInputProps = {
  resetUnreadMessages: () => void
  sendMessage: (message: string) => void
}

function MessageInput({ resetUnreadMessages, sendMessage }: MessageInputProps) {
  const { t } = useTranslation()
  const inputRef = useRef<MentionsInputHandle | null>(null)

  const handleSubmit = useCallback(
    (message: string) => {
      sendMessage(message)
      inputRef.current?.clear()
    },
    [sendMessage]
  )

  return (
    <form className="new-message">
      <MentionsInput
        ref={inputRef}
        className="chat-message-input"
        label={`${t('your_message_to_collaborators')}…`}
        placeholder={`${t('your_message_to_collaborators')}…`}
        onSubmit={handleSubmit}
        onFocus={resetUnreadMessages}
      />
    </form>
  )
}

export default MessageInput
