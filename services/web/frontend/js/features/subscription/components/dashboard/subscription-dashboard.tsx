import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import InstitutionMemberships from './institution-memberships'
import FreePlan from './free-plan'
import PersonalSubscription from './personal-subscription'
import ManagedGroupSubscriptions from './managed-group-subscriptions'

function SubscriptionDashboard() {
  const { t } = useTranslation()
  const institutionMemberships = getMeta('ol-currentInstitutionsWithLicence')
  const subscription = getMeta('ol-subscription')
  const managedGroupSubscriptions = getMeta('ol-managedGroupSubscriptions')

  const hasDisplayedSubscription =
    institutionMemberships?.length > 0 ||
    subscription ||
    managedGroupSubscriptions?.length > 0

  return (
    <div className="container">
      <div className="row">
        <div className="col-md-8 col-md-offset-2">
          <div className="card">
            <div className="page-header">
              <h1>{t('your_subscription')}</h1>
            </div>

            <PersonalSubscription subscription={subscription} />
            <ManagedGroupSubscriptions
              subscriptions={managedGroupSubscriptions}
            />
            <InstitutionMemberships memberships={institutionMemberships} />
            {!hasDisplayedSubscription && <FreePlan />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionDashboard
