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

function SubscriptionDashboard() {
  const { t } = useTranslation()
  const { hasDisplayedSubscription, hasSubscription } =
    useSubscriptionDashboardContext()

  const fromPlansPage: boolean = getMeta('ol-fromPlansPage')

  return (
    <div className="container">
      <div className="row">
        <div className="col-md-8 col-md-offset-2">
          {fromPlansPage && (
            <div className="alert alert-warning" aria-live="polite">
              {t('you_already_have_a_subscription')}
            </div>
          )}
          <div className="card">
            <div className="page-header">
              <h1>{t('your_subscription')}</h1>
            </div>

            <PersonalSubscription />
            <ManagedGroupSubscriptions />
            <ManagedInstitutions />
            <ManagedPublishers />
            <GroupSubscriptionMemberships />
            <InstitutionMemberships />
            {!hasDisplayedSubscription &&
              (hasSubscription ? <ContactSupport /> : <FreePlan />)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionDashboard
