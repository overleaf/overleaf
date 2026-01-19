import { Trans, useTranslation } from 'react-i18next'
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
import OLPageContentCard from '@/shared/components/ol/ol-page-content-card'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLNotification from '@/shared/components/ol/ol-notification'
import WritefullManagedBundleAddOn from './states/active/change-plan/modals/writefull-bundle-management-modal'
import RedirectAlerts from './redirect-alerts'
import { PaidSubscription } from '@ol-types/subscription/dashboard/subscription'

function SubscriptionDashboard() {
  const { t } = useTranslation()
  const {
    hasDisplayedSubscription,
    hasSubscription,
    hasValidActiveSubscription,
    personalSubscription,
  } = useSubscriptionDashboardContext()

  const subscription = personalSubscription as PaidSubscription

  const hasAiAssistViaWritefull = getMeta('ol-hasAiAssistViaWritefull')
  const fromPlansPage = getMeta('ol-fromPlansPage')
  const hasRedirectedPaymentError = Boolean(
    getMeta('ol-subscriptionPaymentErrorCode')
  )

  const hasPendingPlan =
    subscription &&
    subscription.pendingPlan &&
    subscription.pendingPlan.name !== subscription.plan.name
  const nextPaymentDueDate = subscription?.payment?.nextPaymentDueDate

  return (
    <div className="container">
      <OLRow>
        <OLCol lg={{ span: 8, offset: 2 }}>
          {hasPendingPlan && (
            <OLNotification
              className="mb-4"
              aria-live="polite"
              content={
                <div>
                  <Trans
                    i18nKey="pending_subscription_message"
                    values={{
                      planName: personalSubscription?.pendingPlan?.name,
                      activationDate: nextPaymentDueDate,
                    }}
                    shouldUnescape
                    tOptions={{ interpolation: { escapeValue: true } }}
                    components={[
                      // eslint-disable-next-line react/jsx-key
                      <strong />,
                    ]}
                  />
                </div>
              }
              type="success"
            />
          )}
          {fromPlansPage && (
            <OLNotification
              className="mb-4"
              aria-live="polite"
              content={t('you_already_have_a_subscription')}
              type="warning"
            />
          )}
          {hasRedirectedPaymentError && (
            <OLNotification
              className="mb-4"
              aria-live="polite"
              content={
                <Trans
                  i18nKey="payment_error_generic"
                  components={[
                    /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
                    <a href="/contact" target="_blank" />,
                  ]}
                />
              }
              type="error"
            />
          )}
          <RedirectAlerts />
          <OLPageContentCard>
            <div className="page-header">
              <h1>{t('your_subscriptions')}</h1>
            </div>

            <div>
              <PersonalSubscription />
              <ManagedGroupSubscriptions />
              <ManagedInstitutions />
              <ManagedPublishers />
              <GroupSubscriptionMemberships />
              <InstitutionMemberships />
              {!personalSubscription && hasAiAssistViaWritefull && (
                <div className="mb-4">
                  <h2 className="h3 fw-bold">{t('add_ons')}</h2>
                  <WritefullManagedBundleAddOn />
                </div>
              )}
              {hasValidActiveSubscription && (
                <PremiumFeaturesLink subscription={personalSubscription} />
              )}
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
