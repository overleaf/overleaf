import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import OLBadge from '@/shared/components/ol/ol-badge'

function ChatToggleButton({
  chatIsOpen,
  unreadMessageCount,
  onClick,
}: {
  chatIsOpen: boolean
  unreadMessageCount: number
  onClick: () => void
}) {
  const { t } = useTranslation()
  const classes = classNames('btn', 'btn-full-height', { active: chatIsOpen })

  const hasUnreadMessages = unreadMessageCount > 0

  return (
    <div className="toolbar-item">
      <button type="button" className={classes} onClick={onClick}>
        <MaterialIcon
          type="chat"
          className={classNames('align-middle', {
            bounce: hasUnreadMessages,
          })}
        />
        {hasUnreadMessages && <OLBadge bg="info">{unreadMessageCount}</OLBadge>}
        <p className="toolbar-label">{t('chat')}</p>
      </button>
    </div>
  )
}

export default ChatToggleButton
