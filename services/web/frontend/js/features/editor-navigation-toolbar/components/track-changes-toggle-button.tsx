import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'

function TrackChangesToggleButton({
  trackChangesIsOpen,
  disabled,
  onMouseDown,
}: {
  trackChangesIsOpen: boolean
  disabled?: boolean
  onMouseDown: (e: React.MouseEvent) => void
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
        <MaterialIcon type="rate_review" className="align-middle" />
        <p className="toolbar-label">{t('review')}</p>
      </button>
      <div id="toolbar-cio-review" className="toolbar-cio-tooltip" />
    </div>
  )
}

export default TrackChangesToggleButton
