import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import InstitutionMemberships from './institution-memberships'
import FreePlan from './free-plan'
import PersonalSubscription from './personal-subscription'

function SubscriptionDashboard() {
  const { t } = useTranslation()
  const institutionMemberships = getMeta('ol-currentInstitutionsWithLicence')
  const subscription = getMeta('ol-subscription')

  const hasDisplayedSubscription =
    institutionMemberships?.length > 0 || subscription

  return (
    <div className="container">
      <div className="row">
        <div className="col-md-8 col-md-offset-2">
          <div className="card">
            <div className="page-header">
              <h1>{t('your_subscription')}</h1>
            </div>

            <InstitutionMemberships memberships={institutionMemberships} />
            <PersonalSubscription subscription={subscription} />
            {!hasDisplayedSubscription && <FreePlan />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionDashboard
