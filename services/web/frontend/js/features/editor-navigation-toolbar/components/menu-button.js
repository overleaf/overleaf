import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'

function MenuButton({ onClick }) {
  const { t } = useTranslation()

  return (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a role="button" className="btn btn-full-height" href="#" onClick={onClick}>
      <Icon type="fw" modifier="bars" classes={{ icon: 'editor-menu-icon' }} />
      <p className="toolbar-label">{t('menu')}</p>
    </a>
  )
}

MenuButton.propTypes = {
  onClick: PropTypes.func.isRequired
}

export default MenuButton
