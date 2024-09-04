import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

function MenuButton({ onClick }) {
  const { t } = useTranslation()

  return (
    <div className="toolbar-item">
      <button type="button" className="btn btn-full-height" onClick={onClick}>
        <BootstrapVersionSwitcher
          bs3={<Icon type="bars" fw className="editor-menu-icon" />}
          bs5={
            <MaterialIcon
              type="menu"
              className="editor-menu-icon align-middle"
            />
          }
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
