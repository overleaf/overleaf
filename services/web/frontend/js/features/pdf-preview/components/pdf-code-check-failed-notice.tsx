import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import OLNotification from '@/features/ui/components/ol/ol-notification'

function PdfCodeCheckFailedNotice() {
  const { t } = useTranslation()
  return (
    <OLNotification
      type="error"
      content={t('code_check_failed_explanation')}
      className="m-0"
    />
  )
}

export default memo(PdfCodeCheckFailedNotice)
