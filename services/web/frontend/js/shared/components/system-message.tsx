import Close from './close'
import usePersistedState from '../hooks/use-persisted-state'

type SystemMessageProps = {
  id: string
  children: React.ReactNode
}

function SystemMessage({ id, children }: SystemMessageProps) {
  const [hidden, setHidden] = usePersistedState(
    `systemMessage.hide.${id}`,
    false
  )

  if (hidden) {
    return null
  }

  return (
    <li className="system-message">
      {id !== 'protected' ? (
        <Close onDismiss={() => setHidden(true)} variant="dark" />
      ) : null}
      {children}
    </li>
  )
}

export default SystemMessage
