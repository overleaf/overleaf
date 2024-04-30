import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'

function HistoryToggleButton({ onClick }) {
  const { t } = useTranslation()

  return (
    <div className="toolbar-item">
      <button className="btn btn-full-height" onClick={onClick}>
        <Icon type="history" fw />
        <p className="toolbar-label">{t('history')}</p>
      </button>
    </div>
  )
}

HistoryToggleButton.propTypes = {
  onClick: PropTypes.func.isRequired,
}

export default HistoryToggleButton
