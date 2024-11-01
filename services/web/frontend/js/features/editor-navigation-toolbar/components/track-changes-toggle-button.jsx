import PropTypes from 'prop-types'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'

function TrackChangesToggleButton({
  trackChangesIsOpen,
  disabled,
  onMouseDown,
}) {
  const { t } = useTranslation()
  const classes = classNames('btn', 'btn-full-height', {
    active: trackChangesIsOpen && !disabled,
    disabled,
  })

  return (
    <div className="toolbar-item">
      <button
        type="button"
        disabled={disabled}
        className={classes}
        onMouseDown={onMouseDown}
      >
        <BootstrapVersionSwitcher
          bs3={<i className="review-icon" />}
          bs5={<MaterialIcon type="rate_review" className="align-middle" />}
        />
        <p className="toolbar-label">{t('review')}</p>
      </button>
    </div>
  )
}

TrackChangesToggleButton.propTypes = {
  trackChangesIsOpen: PropTypes.bool,
  disabled: PropTypes.bool,
  onMouseDown: PropTypes.func.isRequired,
}

export default TrackChangesToggleButton
