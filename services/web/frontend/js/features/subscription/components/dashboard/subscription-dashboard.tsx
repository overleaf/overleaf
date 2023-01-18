import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import InstitutionMemberships from './institution-memberships'
import FreePlan from './free-plan'
import PremiumFeaturesLink from './premium-features-link'

function SubscriptionDashboard() {
  const { t } = useTranslation()
  const institutionMemberships = getMeta('ol-currentInstitutionsWithLicence')
  const hasDisplayedSubscription = institutionMemberships?.length > 0

  return (
    <div className="container">
      <div className="row">
        <div className="col-md-8 col-md-offset-2">
          <div className="card">
            <div className="page-header">
              <h1>{t('your_subscription')}</h1>
            </div>

            <InstitutionMemberships memberships={institutionMemberships} />
            {hasDisplayedSubscription ? <PremiumFeaturesLink /> : <FreePlan />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionDashboard
