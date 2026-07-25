import { useTranslation, Trans } from 'react-i18next'
import { PriceExceptions } from '../shared/price-exceptions'
import PremiumFeaturesLink from '../dashboard/premium-features-link'
import getMeta from '../../../../utils/meta'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLPageContentCard from '@/shared/components/ol/ol-page-content-card'
import OLNotification from '@/shared/components/ol/ol-notification'
import {
  AI_ADD_ON_CODE,
  ADD_ON_NAME,
  isStandaloneAiPlanCode,
} from '../../data/add-on-codes'
import { PaidSubscription } from '../../../../../../types/subscription/dashboard/subscription'
import { useBroadcastUser } from '@/shared/hooks/user-channel/use-broadcast-user'
import { getUpgradePlanDisplayName } from '../../util/plan-display-names'

function SuccessfulSubscription() {
  const { t } = useTranslation()
  const { personalSubscription: subscription } =
    useSubscriptionDashboardContext()
  const postCheckoutRedirect = getMeta('ol-postCheckoutRedirect')
  const isUpgrade = getMeta('ol-isUpgrade')
  const { appName, adminEmail } = getMeta('ol-ExposedSettings')
  useBroadcastUser()

  if (!subscription || !('payment' in subscription)) return null

  if (isUpgrade) {
    return (
      <UpgradeSuccess
        subscription={subscription}
        postCheckoutRedirect={postCheckoutRedirect}
      />
    )
  }

  const onAiStandalonePlan = isStandaloneAiPlanCode(subscription.planCode)

  return (
    <div className="container">
      <OLRow>
        <OLCol lg={{ span: 8, offset: 2 }}>
          <OLPageContentCard>
            <h2>{t('thanks_for_subscribing')}</h2>
            <OLNotification
              type="success"
              content={
                <>
                  {subscription.payment.trialEndsAt && (
                    <>
                      <p>
                        <Trans
                          i18nKey="next_payment_of_x_collectected_on_y"
                          values={{
                            paymentAmmount: subscription.payment.displayPrice,
                            collectionDate:
                              subscription.payment.nextPaymentDueAt,
                          }}
                          shouldUnescape
                          tOptions={{ interpolation: { escapeValue: true } }}
                          components={[<strong />, <strong />]} // eslint-disable-line react/jsx-key
                        />
                      </p>
                      <PriceExceptions subscription={subscription} />
                    </>
                  )}
                  <div className="d-flex justify-content-between align-items-center gap-3">
                    <span>{t('to_modify_your_subscription_go_to')}</span>
                    <a href="/user/subscription" rel="noopener noreferrer">
                      {t('manage_subscription')}
                    </a>
                  </div>
                </>
              }
            />
            {subscription.groupPlan && (
              <p>
                <a
                  href={`/manage/groups/${subscription._id}/members`}
                  className="btn btn-primary btn-large"
                >
                  {t('invite_group_members')}
                </a>
              </p>
            )}
            <ThankYouSection
              subscription={subscription}
              onAiStandalonePlan={onAiStandalonePlan}
            />
            <PremiumFeaturesLink subscription={subscription} />
            <p>
              {t('need_anything_contact_us_at')}&nbsp;
              <a href={`mailto:${adminEmail}`} rel="noopener noreferrer">
                {adminEmail}
              </a>
              .
            </p>
            {!onAiStandalonePlan && (
              <p>
                <Trans
                  i18nKey="help_improve_overleaf_fill_out_this_survey"
                  components={[
                    // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
                    <a
                      href="https://forms.gle/CdLNX9m6NLxkv1yr5"
                      target="_blank"
                      rel="noopener noreferrer"
                    />,
                  ]}
                />
              </p>
            )}
            <p>
              {t('regards')},
              <br />
              The {appName} Team
            </p>
            <p>
              <a
                className="btn btn-primary"
                href={postCheckoutRedirect || '/project'}
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

function UpgradeSuccess({
  subscription,
  postCheckoutRedirect,
}: {
  subscription: PaidSubscription
  postCheckoutRedirect: string | undefined
}) {
  const { t } = useTranslation()
  const planDisplayName = getUpgradePlanDisplayName(subscription.planCode, t)
  let benefitsText = ''
  if (subscription.planCode.startsWith('professional')) {
    benefitsText = t('get_ready_for_overleaf_at_its_best_pro')
  } else if (subscription.planCode.startsWith('collaborator')) {
    benefitsText = t('get_ready_for_overleaf_standard')
  }

  return (
    <div className="container">
      <OLRow>
        <OLCol lg={{ span: 8, offset: 2 }}>
          <OLPageContentCard>
            <h2>{t('welcome_to_plan', { planName: planDisplayName })}</h2>
            <OLNotification
              type="success"
              content={
                <div className="d-flex justify-content-between align-items-center gap-3">
                  <span>{t('youve_upgraded_your_subscription')}</span>
                  <a href="/user/subscription" rel="noopener noreferrer">
                    {t('manage_subscription')}
                  </a>
                </div>
              }
            />
            <p>
              <Trans
                i18nKey="next_payment_of_x_collectected_on_y"
                values={{
                  paymentAmmount: subscription.payment.displayPrice,
                  collectionDate: subscription.payment.nextPaymentDueAt,
                }}
                shouldUnescape
                tOptions={{ interpolation: { escapeValue: true } }}
                components={[<strong />, <strong />]} // eslint-disable-line react/jsx-key
              />
            </p>
            <PriceExceptions subscription={subscription} />
            {benefitsText && <p>{benefitsText}</p>}
            <p>
              <Trans
                i18nKey="find_out_how_to_get_the_most_out_of_your_new_subscription"
                components={[
                  // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
                  <a
                    href="https://docs.overleaf.com/integrations-and-add-ons/ai-features"
                    target="_blank"
                    rel="noopener noreferrer"
                  />,
                ]}
              />
            </p>
            <p>
              <a
                className="btn btn-primary"
                href={postCheckoutRedirect || '/project'}
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

function ThankYouSection({
  subscription,
  onAiStandalonePlan,
}: {
  subscription: PaidSubscription
  onAiStandalonePlan: boolean
}) {
  const { t } = useTranslation()
  const hasAiAddon = subscription?.addOns?.some(
    addOn => addOn.addOnCode === AI_ADD_ON_CODE
  )

  if (onAiStandalonePlan) {
    return (
      <p>
        {t('thanks_for_subscribing_to_the_add_on', {
          addOnName: ADD_ON_NAME,
        })}
      </p>
    )
  }
  if (hasAiAddon) {
    return (
      <p>
        {t('thanks_for_subscribing_to_plan_with_add_on', {
          planName: subscription.plan.name,
          addOnName: ADD_ON_NAME,
        })}
      </p>
    )
  }

  return (
    <p>
      {t('thanks_for_subscribing_you_help_sl', {
        planName: subscription.plan.name,
      })}
    </p>
  )
}

export default SuccessfulSubscription
