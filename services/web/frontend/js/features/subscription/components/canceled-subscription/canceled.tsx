import { useTranslation } from 'react-i18next'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLPageContentCard from '@/shared/components/ol/ol-page-content-card'
import OLNotification from '@/shared/components/ol/ol-notification'

function Canceled() {
  const { t } = useTranslation()

  return (
    <div className="container">
      <OLRow>
        <OLCol lg={{ span: 8, offset: 2 }}>
          <OLPageContentCard>
            <div className="page-header">
              <h2>{t('subscription_canceled')}</h2>
            </div>
            <OLNotification
              type="info"
              content={
                <p>
                  {t('to_modify_your_subscription_go_to')}&nbsp;
                  <a href="/user/subscription" rel="noopener noreferrer">
                    {t('manage_subscription')}.
                  </a>
                </p>
              }
            />
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
