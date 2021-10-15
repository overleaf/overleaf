import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import usePersistedState from '../../../shared/hooks/use-persisted-state'

function PdfLogsPaneInfoNotice() {
  const { t } = useTranslation()

  const [dismissed, setDismissed] = usePersistedState(
    'logs_pane.dismissed_info_notice',
    false
  )

  if (dismissed) {
    return null
  }

  return (
    <div className="log-entry">
      <div className="log-entry-header log-entry-header-raw">
        <div className="log-entry-header-icon-container">
          <span className="info-badge" />
        </div>
        <h3 className="log-entry-header-title">
          {t('logs_pane_info_message')}
        </h3>
        <a
          href="https://forms.gle/zYByeRPcDtA6nDS19"
          target="_blank"
          rel="noopener noreferrer"
          className="log-entry-header-link log-entry-header-link-raw"
        >
          <span className="log-entry-header-link-location">
            {t('give_feedback')}
          </span>
        </a>
        <button
          className="btn-inline-link log-entry-header-link"
          type="button"
          aria-label={t('dismiss')}
          onClick={() => setDismissed(true)}
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    </div>
  )
}

export default memo(PdfLogsPaneInfoNotice)
