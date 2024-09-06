import PropTypes from 'prop-types'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'
import OLBadge from '@/features/ui/components/ol/ol-badge'

function ChatToggleButton({ chatIsOpen, unreadMessageCount, onClick }) {
  const { t } = useTranslation()
  const classes = classNames('btn', 'btn-full-height', { active: chatIsOpen })

  const hasUnreadMessages = unreadMessageCount > 0

  return (
    <div className="toolbar-item">
      <button type="button" className={classes} onClick={onClick}>
        <BootstrapVersionSwitcher
          bs3={
            <Icon
              type="comment"
              fw
              className={classNames({ bounce: hasUnreadMessages })}
            />
          }
          bs5={
            <MaterialIcon
              type="chat"
              className={classNames('align-middle', {
                bounce: hasUnreadMessages,
              })}
            />
          }
        />
        {hasUnreadMessages && <OLBadge bg="info">{unreadMessageCount}</OLBadge>}
        <p className="toolbar-label">{t('chat')}</p>
      </button>
    </div>
  )
}

ChatToggleButton.propTypes = {
  chatIsOpen: PropTypes.bool,
  unreadMessageCount: PropTypes.number.isRequired,
  onClick: PropTypes.func.isRequired,
}

export default ChatToggleButton
