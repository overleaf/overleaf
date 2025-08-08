import { useTranslation } from 'react-i18next'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import Notification from '@/shared/components/notification'

export default function DashApiError() {
  const { t } = useTranslation()
  return (
    <OLRow className="row-spaced">
      <OLCol xs={{ span: 8, offset: 2 }} aria-live="polite">
        <div className="notification-list">
          <Notification
            content={t('generic_something_went_wrong')}
            type="error"
          />
        </div>
      </OLCol>
    </OLRow>
  )
}
