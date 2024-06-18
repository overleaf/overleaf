import { useEffect } from 'react'
import SystemMessage from './system-message'
import TranslationMessage from './translation-message'
import useAsync from '../hooks/use-async'
import { getJSON } from '@/infrastructure/fetch-json'
import getMeta from '../../utils/meta'
import { SystemMessage as TSystemMessage } from '../../../../types/system-message'
import { debugConsole } from '@/utils/debugging'

const MESSAGE_POLL_INTERVAL = 15 * 60 * 1000

function SystemMessages() {
  const { data: messages, runAsync } = useAsync<TSystemMessage[]>()
  const suggestedLanguage = getMeta('ol-suggestedLanguage')

  useEffect(() => {
    const pollMessages = () => {
      // Ignore polling if tab is hidden or browser is offline
      if (document.hidden || !navigator.onLine) {
        return
      }

      runAsync(getJSON('/system/messages')).catch(debugConsole.error)
    }
    pollMessages()

    const interval = setInterval(pollMessages, MESSAGE_POLL_INTERVAL)

    return () => {
      clearInterval(interval)
    }
  }, [runAsync])

  if (!messages?.length && !suggestedLanguage) {
    return null
  }

  return (
    <ul className="system-messages">
      {messages?.map((message, idx) => (
        <SystemMessage key={idx} id={message._id}>
          {message.content}
        </SystemMessage>
      ))}
      {suggestedLanguage ? <TranslationMessage /> : null}
    </ul>
  )
}

export default SystemMessages
