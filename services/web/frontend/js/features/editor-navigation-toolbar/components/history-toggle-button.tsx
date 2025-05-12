import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'

function HistoryToggleButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="toolbar-item">
      <button type="button" className="btn btn-full-height" onClick={onClick}>
        <MaterialIcon type="history" className="align-middle" />
        <p className="toolbar-label">{t('history')}</p>
      </button>
      <div id="toolbar-cio-history" className="toolbar-cio-tooltip" />
    </div>
  )
}

export default HistoryToggleButton
