import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'

function MenuButton({ onClick }) {
  const { t } = useTranslation()

  return (
    <div className="toolbar-item">
      <button className="btn btn-full-height" onClick={onClick}>
        <Icon
          type="bars "
          modifier="fw"
          classes={{ icon: 'editor-menu-icon' }}
        />
        <p className="toolbar-label">{t('menu')}</p>
      </button>
    </div>
  )
}

MenuButton.propTypes = {
  onClick: PropTypes.func.isRequired,
}

export default MenuButton
