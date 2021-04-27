import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'

function ChatToggleButton({ chatIsOpen, unreadMessageCount, onClick }) {
  const { t } = useTranslation()
  const classes = classNames(
    'btn',
    'btn-full-height',
    'btn-full-height-no-border',
    { active: chatIsOpen }
  )

  const hasUnreadMessages = unreadMessageCount > 0

  return (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a role="button" className={classes} href="#" onClick={onClick}>
      <Icon
        type="fw"
        modifier="comment"
        classes={{ icon: hasUnreadMessages ? 'bounce' : undefined }}
      />
      {hasUnreadMessages ? (
        <span className="label label-info">{unreadMessageCount}</span>
      ) : null}
      <p className="toolbar-label">{t('chat')}</p>
    </a>
  )
}

ChatToggleButton.propTypes = {
  chatIsOpen: PropTypes.bool,
  unreadMessageCount: PropTypes.number.isRequired,
  onClick: PropTypes.func.isRequired,
}

export default ChatToggleButton
