import { useTranslation } from 'react-i18next'
import ContactSupport from './contact-support-for-custom-subscription'
import GroupSubscriptionMemberships from './group-subscription-memberships'
import InstitutionMemberships from './institution-memberships'
import FreePlan from './free-plan'
import ManagedPublishers from './managed-publishers'
import PersonalSubscription from './personal-subscription'
import ManagedGroupSubscriptions from './managed-group-subscriptions'
import ManagedInstitutions from './managed-institutions'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import getMeta from '../../../../utils/meta'
import PremiumFeaturesLink from './premium-features-link'
import OLPageContentCard from '@/features/ui/components/ol/ol-page-content-card'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'
import OLNotification from '@/features/ui/components/ol/ol-notification'

function SubscriptionDashboard() {
  const { t } = useTranslation()
  const {
    hasDisplayedSubscription,
    hasSubscription,
    hasValidActiveSubscription,
  } = useSubscriptionDashboardContext()

  const fromPlansPage = getMeta('ol-fromPlansPage')

  return (
    <div className="container">
      <OLRow>
        <OLCol lg={{ span: 8, offset: 2 }}>
          {fromPlansPage && (
            <OLNotification
              className="mb-4"
              aria-live="polite"
              content={t('you_already_have_a_subscription')}
              type="warning"
            />
          )}
          <OLPageContentCard>
            <div className="page-header">
              <h1>{t('your_subscription')}</h1>
            </div>

            <div>
              <PersonalSubscription />
              <ManagedGroupSubscriptions />
              <ManagedInstitutions />
              <ManagedPublishers />
              <GroupSubscriptionMemberships />
              <InstitutionMemberships />
              {hasValidActiveSubscription && <PremiumFeaturesLink />}
              {!hasDisplayedSubscription &&
                (hasSubscription ? <ContactSupport /> : <FreePlan />)}
            </div>
          </OLPageContentCard>
        </OLCol>
      </OLRow>
    </div>
  )
}

export default SubscriptionDashboard
