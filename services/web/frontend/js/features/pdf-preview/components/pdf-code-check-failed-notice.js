import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'

function PdfCodeCheckFailedNotice() {
  const { t } = useTranslation()

  return (
    <div className="log-entry">
      <div className="log-entry-header log-entry-header-error">
        <div className="log-entry-header-icon-container">
          <Icon type="exclamation-triangle" modifier="fw" />
        </div>
        <h3 className="log-entry-header-title">
          {t('code_check_failed_explanation')}
        </h3>
      </div>
    </div>
  )
}

export default memo(PdfCodeCheckFailedNotice)
