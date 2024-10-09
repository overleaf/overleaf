import { useTranslation } from 'react-i18next'
import { bsVersion } from '@/features/utils/bootstrap-5'

type MessageInputProps = {
  resetUnreadMessages: () => void
  sendMessage: (message: string) => void
}

function MessageInput({ resetUnreadMessages, sendMessage }: MessageInputProps) {
  const { t } = useTranslation()

  function handleKeyDown(event: React.KeyboardEvent) {
    const selectingCharacter = event.nativeEvent.isComposing
    if (event.key === 'Enter' && !selectingCharacter) {
      event.preventDefault()
      const target = event.target as HTMLInputElement
      sendMessage(target.value)
      // wrap the form reset in setTimeout so input sources have time to finish
      // https://github.com/overleaf/internal/pull/9206
      window.setTimeout(() => {
        target.blur()
        target.closest('form')?.reset()
        target.focus()
      }, 0)
    }
  }

  return (
    <form className="new-message">
      <label
        htmlFor="chat-input"
        className={bsVersion({ bs3: 'sr-only', bs5: 'visually-hidden' })}
      >
        {t('your_message_to_collaborators')}
      </label>
      <textarea
        id="chat-input"
        placeholder={`${t('your_message_to_collaborators')}…`}
        onKeyDown={handleKeyDown}
        onClick={resetUnreadMessages}
      />
    </form>
  )
}

export default MessageInput
