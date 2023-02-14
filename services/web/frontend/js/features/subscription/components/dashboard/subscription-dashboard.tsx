import { useTranslation } from 'react-i18next'
import InstitutionMemberships from './institution-memberships'
import FreePlan from './free-plan'
import PersonalSubscription from './personal-subscription'
import ManagedGroupSubscriptions from './managed-group-subscriptions'
import ManagedInstitutions from './managed-institutions'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'

function SubscriptionDashboard() {
  const { t } = useTranslation()
  const { hasDisplayedSubscription } = useSubscriptionDashboardContext()

  return (
    <div className="container">
      <div className="row">
        <div className="col-md-8 col-md-offset-2">
          <div className="card">
            <div className="page-header">
              <h1>{t('your_subscription')}</h1>
            </div>

            <PersonalSubscription />
            <ManagedGroupSubscriptions />
            <ManagedInstitutions />
            <InstitutionMemberships />
            {!hasDisplayedSubscription && <FreePlan />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionDashboard
