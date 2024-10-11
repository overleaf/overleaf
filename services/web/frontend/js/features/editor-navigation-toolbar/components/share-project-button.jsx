import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

function ShareProjectButton({ onClick }) {
  const { t } = useTranslation()

  return (
    <div className="toolbar-item">
      <button type="button" className="btn btn-full-height" onClick={onClick}>
        <BootstrapVersionSwitcher
          bs3={<Icon type="group" fw />}
          bs5={<MaterialIcon type="group_add" className="align-middle" />}
        />
        <p className="toolbar-label">{t('share')}</p>
      </button>
    </div>
  )
}

ShareProjectButton.propTypes = {
  onClick: PropTypes.func.isRequired,
}

export default ShareProjectButton
