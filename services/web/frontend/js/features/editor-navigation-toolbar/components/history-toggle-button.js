import PropTypes from 'prop-types'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'

function HistoryToggleButton({ historyIsOpen, onClick }) {
  const { t } = useTranslation()

  const classes = classNames('btn', 'btn-full-height', {
    active: historyIsOpen,
  })

  return (
    <div className="toolbar-item">
      <button className={classes} onClick={onClick}>
        <Icon type="history" fw />
        <p className="toolbar-label">{t('history')}</p>
      </button>
    </div>
  )
}

HistoryToggleButton.propTypes = {
  historyIsOpen: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
}

export default HistoryToggleButton
