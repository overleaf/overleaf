import { useTranslation } from 'react-i18next'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLPageContentCard from '@/shared/components/ol/ol-page-content-card'
import Notification from '@/shared/components/notification'

function Canceled() {
  const { t } = useTranslation()

  return (
    <div className="container">
      <OLRow>
        <OLCol lg={{ span: 8, offset: 2 }}>
          <OLPageContentCard>
            <h2>{t('subscription_canceled')}</h2>
            <div className="notification-list">
              <Notification
                type="info"
                content={
                  <div className="d-flex justify-content-between align-items-center gap-3">
                    <span>{t('to_modify_your_subscription_go_to')}</span>
                    <a href="/user/subscription" rel="noopener noreferrer">
                      {t('manage_subscription')}
                    </a>
                  </div>
                }
              />
            </div>
            <p>
              <a
                className="btn btn-primary"
                href="/project"
                rel="noopener noreferrer"
              >
                {t('back_to_your_projects')}
              </a>
            </p>
          </OLPageContentCard>
        </OLCol>
      </OLRow>
    </div>
  )
}

export default Canceled
