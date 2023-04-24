import PropTypes from 'prop-types'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

function TrackChangesToggleButton({ trackChangesIsOpen, disabled, onClick }) {
  const { t } = useTranslation()
  const classes = classNames('btn', 'btn-full-height', {
    active: trackChangesIsOpen && !disabled,
    disabled,
  })

  return (
    <div className="toolbar-item">
      <button disabled={disabled} className={classes} onMouseDown={onClick}>
        <i className="review-icon" />
        <p className="toolbar-label">{t('review')}</p>
      </button>
    </div>
  )
}

TrackChangesToggleButton.propTypes = {
  trackChangesIsOpen: PropTypes.bool,
  disabled: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
}

export default TrackChangesToggleButton
