import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'

function HistoryToggleButton({ onClick }) {
  const { t } = useTranslation()

  return (
    <div className="toolbar-item">
      <button type="button" className="btn btn-full-height" onClick={onClick}>
        <MaterialIcon type="history" className="align-middle" />
        <p className="toolbar-label">{t('history')}</p>
      </button>
    </div>
  )
}

HistoryToggleButton.propTypes = {
  onClick: PropTypes.func.isRequired,
}

export default HistoryToggleButton
