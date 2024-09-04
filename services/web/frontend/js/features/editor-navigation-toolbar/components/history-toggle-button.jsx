import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

function HistoryToggleButton({ onClick }) {
  const { t } = useTranslation()

  return (
    <div className="toolbar-item">
      <button type="button" className="btn btn-full-height" onClick={onClick}>
        <BootstrapVersionSwitcher
          bs3={<Icon type="history" fw />}
          bs5={<MaterialIcon type="history" className="align-middle" />}
        />
        <p className="toolbar-label">{t('history')}</p>
      </button>
    </div>
  )
}

HistoryToggleButton.propTypes = {
  onClick: PropTypes.func.isRequired,
}

export default HistoryToggleButton
