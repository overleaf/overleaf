import PropTypes from 'prop-types'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

function TrackChangesToggleButton({ trackChangesIsOpen, disabled, onClick }) {
  const { t } = useTranslation()
  const classes = classNames('btn', 'btn-full-height', {
    active: trackChangesIsOpen && !disabled,
    disabled: disabled,
  })

  return (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a
      role="button"
      disabled={disabled}
      className={classes}
      href="#"
      onClick={onClick}
    >
      <i className="review-icon" />
      <p className="toolbar-label">{t('review')}</p>
    </a>
  )
}

TrackChangesToggleButton.propTypes = {
  trackChangesIsOpen: PropTypes.bool,
  disabled: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
}

export default TrackChangesToggleButton
