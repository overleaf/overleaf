import { useTranslation, Trans } from 'react-i18next'
import { PriceExceptions } from '../../../shared/price-exceptions'
import { useSubscriptionDashboardContext } from '../../../../context/subscription-dashboard-context'
import { RecurlySubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import { CancelSubscriptionButton } from './cancel-subscription-button'
import { CancelSubscription } from './cancel-plan/cancel-subscription'
import { PendingPlanChange } from './pending-plan-change'
import { TrialEnding } from './trial-ending'
import { PendingAdditionalLicenses } from './pending-additional-licenses'
import { ContactSupportToChangeGroupPlan } from './contact-support-to-change-group-plan'
import SubscriptionRemainder from './subscription-remainder'
import isInFreeTrial from '../../../../util/is-in-free-trial'
import { ChangePlanModal } from './change-plan/modals/change-plan-modal'
import { ConfirmChangePlanModal } from './change-plan/modals/confirm-change-plan-modal'
import { KeepCurrentPlanModal } from './change-plan/modals/keep-current-plan-modal'
import { ChangeToGroupModal } from './change-plan/modals/change-to-group-modal'
import OLButton from '@/features/ui/components/ol/ol-button'
import { BuyAiAddOnButton } from './change-plan/modals/buy-ai-add-on-modal'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

export function ActiveSubscription({
  subscription,
}: {
  subscription: RecurlySubscription
}) {
  const { t } = useTranslation()
  const { recurlyLoadError, setModalIdShown, showCancellation } =
    useSubscriptionDashboardContext()

  if (showCancellation) return <CancelSubscription />

  const aiAddOnAvailable = isSplitTestEnabled('ai-add-on')
  return (
    <>
      <p>
        <Trans
          i18nKey="currently_subscribed_to_plan"
          values={{
            planName: subscription.plan.name,
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
        {subscription.pendingPlan && (
          <>
            {' '}
            <PendingPlanChange subscription={subscription} />
          </>
        )}
        {!subscription.pendingPlan &&
          subscription.recurly.additionalLicenses > 0 && (
            <>
              {' '}
              <PendingAdditionalLicenses
                additionalLicenses={subscription.recurly.additionalLicenses}
                totalLicenses={subscription.recurly.totalLicenses}
              />
            </>
          )}
        {!recurlyLoadError &&
          !subscription.groupPlan &&
          subscription.recurly.account.has_past_due_invoice._ !== 'true' && (
            <>
              {' '}
              <OLButton
                variant="link"
                className="btn-inline-link"
                onClick={() => setModalIdShown('change-plan')}
              >
                {t('change_plan')}
              </OLButton>
            </>
          )}
      </p>
      {subscription.pendingPlan &&
        subscription.pendingPlan.name !== subscription.plan.name && (
          <p>{t('want_change_to_apply_before_plan_end')}</p>
        )}
      {(!subscription.pendingPlan ||
        subscription.pendingPlan.name === subscription.plan.name) &&
        subscription.plan.groupPlan && <ContactSupportToChangeGroupPlan />}
      {isInFreeTrial(subscription.recurly.trial_ends_at) &&
        subscription.recurly.trialEndsAtFormatted && (
          <TrialEnding
            trialEndsAtFormatted={subscription.recurly.trialEndsAtFormatted}
          />
        )}

      <p>
        <Trans
          i18nKey="next_payment_of_x_collectected_on_y"
          values={{
            paymentAmmount: subscription.recurly.displayPrice,
            collectionDate: subscription.recurly.nextPaymentDueAt,
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      </p>
      <PriceExceptions subscription={subscription} />
      <p className="d-inline-flex flex-wrap gap-1">
        <a
          href={subscription.recurly.billingDetailsLink}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-secondary-info btn-secondary"
        >
          {t('update_your_billing_details')}
        </a>{' '}
        <a
          href={subscription.recurly.accountManagementLink}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-secondary-info btn-secondary"
        >
          {t('view_your_invoices')}
        </a>
        {!recurlyLoadError && (
          <>
            {' '}
            <CancelSubscriptionButton />
          </>
        )}
      </p>

      {!recurlyLoadError && (
        <>
          <br />
          <p>
            <i>
              <SubscriptionRemainder subscription={subscription} />
            </i>
          </p>
        </>
      )}

      <ChangePlanModal />
      <ConfirmChangePlanModal />
      <KeepCurrentPlanModal />
      <ChangeToGroupModal />
      {aiAddOnAvailable && <BuyAiAddOnButton />}
    </>
  )
}
