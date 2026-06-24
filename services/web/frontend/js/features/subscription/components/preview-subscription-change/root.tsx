import { useCallback, useEffect } from 'react'
import moment from 'moment'
import { useTranslation, Trans } from 'react-i18next'
import { SubscriptionChangePreview } from '../../../../../../types/subscription/subscription-change-preview'
import getMeta from '@/utils/meta'
import { formatCurrency } from '@/shared/utils/currency'
import useAsync from '@/shared/hooks/use-async'
import { useLocation } from '@/shared/hooks/use-location'
import { debugConsole } from '@/utils/debugging'
import { FetchError, postJSON } from '@/infrastructure/fetch-json'
import OLCard from '@/shared/components/ol/ol-card'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLButton from '@/shared/components/ol/ol-button'
import { subscriptionUpdateUrl } from '@/features/subscription/data/subscription-url'
import * as eventTracking from '@/infrastructure/event-tracking'
import sparkleText from '@/shared/svgs/ai-sparkle-text.svg'
import PaymentErrorNotification from '@/features/subscription/components/shared/payment-error-notification'
import handleStripePaymentAction from '../../util/handle-stripe-payment-action'
import RedirectedPaymentErrorNotification from '../shared/redirected-payment-error-notification'
import TrialDisabledNotification from './trial-disabled-notification'
import { getUpgradePlanDisplayName } from '../../util/plan-display-names'

function FuturePayments({ preview }: { preview: SubscriptionChangePreview }) {
  const { t } = useTranslation()

  return (
    <>
      <OLRow className="mt-1">
        <OLCol xs={9}>{preview.nextInvoice.plan.name}</OLCol>
        <OLCol xs={3} className="text-end">
          {formatCurrency(preview.nextInvoice.plan.amount, preview.currency)}
        </OLCol>
      </OLRow>

      {preview.nextInvoice.addOns.map(addOn => (
        <OLRow className="mt-1" key={addOn.code}>
          <OLCol xs={9}>
            {addOn.name}
            {addOn.quantity > 1 ? ` ×${addOn.quantity}` : ''}
          </OLCol>
          <OLCol xs={3} className="text-end">
            {formatCurrency(addOn.amount, preview.currency)}
          </OLCol>
        </OLRow>
      ))}

      {preview.nextInvoice.tax.rate > 0 && (
        <OLRow className="mt-1">
          <OLCol xs={9}>
            {t('vat')} {preview.nextInvoice.tax.rate * 100}%
          </OLCol>
          <OLCol xs={3} className="text-end">
            {formatCurrency(preview.nextInvoice.tax.amount, preview.currency)}
          </OLCol>
        </OLRow>
      )}

      <OLRow className="mt-1">
        <OLCol xs={9}>
          {preview.nextPlan.annual ? t('total_per_year') : t('total_per_month')}
        </OLCol>
        <OLCol xs={3} className="text-end">
          {formatCurrency(preview.nextInvoice.total, preview.currency)}
        </OLCol>
      </OLRow>
    </>
  )
}

function NextPaymentDate({ preview }: { preview: SubscriptionChangePreview }) {
  return (
    <div className="mt-5">
      <Trans
        i18nKey="the_next_payment_will_be_collected_on"
        values={{ date: moment(preview.nextInvoice.date).format('LL') }}
        components={{ strong: <strong /> }}
        shouldUnescape
        tOptions={{ interpolation: { escapeValue: true } }}
      />
    </div>
  )
}

function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container">
      <OLRow>
        <OLCol md={{ offset: 2, span: 8 }}>
          <RedirectedPaymentErrorNotification />
          <TrialDisabledNotification />
          <OLCard className="p-3">{children}</OLCard>
        </OLCol>
      </OLRow>
    </div>
  )
}

function DueTodayBlock({
  preview,
  filteredLineItems,
  singleItemName,
  headingClassName,
}: {
  preview: SubscriptionChangePreview
  filteredLineItems: SubscriptionChangePreview['immediateCharge']['lineItems']
  singleItemName: string
  headingClassName?: string
}) {
  const { t } = useTranslation()

  return (
    <>
      <h4 className={headingClassName}>{t('due_today')}:</h4>
      {filteredLineItems.length > 1 ? (
        filteredLineItems.map((item, index) => (
          <OLRow className="mt-1" key={index}>
            <OLCol xs={9}>
              {item.subtotal < 0
                ? t('refund_with_description', {
                    description: item.description,
                  })
                : item.description}
            </OLCol>
            <OLCol xs={3} className="text-end">
              <strong>{formatCurrency(item.subtotal, preview.currency)}</strong>
            </OLCol>
          </OLRow>
        ))
      ) : (
        <OLRow className="mt-1">
          <OLCol xs={9}>{singleItemName}</OLCol>
          <OLCol xs={3} className="text-end">
            <strong>
              {formatCurrency(
                preview.immediateCharge.subtotal,
                preview.currency
              )}
            </strong>
          </OLCol>
        </OLRow>
      )}

      {preview.immediateCharge.tax > 0 && (
        <OLRow className="mt-1">
          <OLCol xs={9}>
            {t('vat')} {preview.nextInvoice.tax.rate * 100}%
          </OLCol>
          <OLCol xs={3} className="text-end">
            {formatCurrency(preview.immediateCharge.tax, preview.currency)}
          </OLCol>
        </OLRow>
      )}

      <OLRow className="mt-1">
        <OLCol xs={9}>{t('total_today')}</OLCol>
        <OLCol xs={3} className="text-end">
          <strong>
            {formatCurrency(preview.immediateCharge.total, preview.currency)}
          </strong>
        </OLCol>
      </OLRow>
    </>
  )
}

function PreviewSubscriptionChange() {
  const preview = getMeta(
    'ol-subscriptionChangePreview'
  ) as SubscriptionChangePreview
  const purchaseReferrer = getMeta('ol-purchaseReferrer')
  const { t } = useTranslation()
  const payNowTask = useAsync()
  const location = useLocation()

  const isPremiumUpgrade = preview.change.type === 'premium-subscription'
  const filteredLineItems = preview.immediateCharge.lineItems.filter(
    (item, index, arr) => {
      if (!item.isAiAssist) return true

      // TODO: this can be removed when all subscriptions are using Stripe
      const isCanceledByAnotherItem = arr.some(
        (otherItem, otherIndex) =>
          otherIndex !== index &&
          otherItem.isAiAssist &&
          otherItem.subtotal + item.subtotal === 0
      )

      return !isCanceledByAnotherItem
    }
  )

  useEffect(() => {
    if (preview.change.type === 'add-on-purchase') {
      eventTracking.sendMB('preview-subscription-change-view', {
        plan: preview.change.addOn.code,
        upgradeType: 'add-on',
        referrer: purchaseReferrer,
      })
    }
  }, [preview.change, purchaseReferrer])

  const handlePayNowClick = useCallback(() => {
    if (preview.change.type === 'add-on-purchase') {
      eventTracking.sendMB('subscription-change-form-submit', {
        plan: preview.change.addOn.code,
        upgradeType: 'add-on',
        referrer: purchaseReferrer,
      })
      eventTracking.sendMB('assistant-add-on-purchase')
    }

    payNowTask
      .runAsync(payNow(preview))
      .then(() => {
        if (preview.change.type === 'add-on-purchase') {
          eventTracking.sendMB('subscription-change-form-success', {
            plan: preview.change.addOn.code,
            upgradeType: 'add-on',
            referrer: purchaseReferrer,
          })
        }
        location.replace(
          isPremiumUpgrade
            ? '/user/subscription/thank-you?upgrade=true'
            : '/user/subscription/thank-you'
        )
      })
      .catch(debugConsole.error)
  }, [purchaseReferrer, location, payNowTask, preview, isPremiumUpgrade])

  if (preview.change.type === 'premium-subscription') {
    const change = preview.change
    const upgradePlanName = getUpgradePlanDisplayName(change.plan.code, t)

    return (
      <PreviewLayout>
        <h2>{t('upgrade_to_plan', { planName: upgradePlanName })}</h2>

        {payNowTask.isError && (
          <PaymentErrorNotification error={payNowTask.error as FetchError} />
        )}

        <h3 className="mt-5">{t('payment_summary')}</h3>

        <DueTodayBlock
          preview={preview}
          filteredLineItems={filteredLineItems}
          singleItemName={change.plan.name}
          headingClassName="mt-4"
        />

        <hr />

        <h4 className="mt-4">{t('future_payments')}:</h4>
        <FuturePayments preview={preview} />
        <NextPaymentDate preview={preview} />

        <div className="mt-5">
          <OLButton
            variant="primary"
            size="lg"
            onClick={handlePayNowClick}
            disabled={payNowTask.isLoading || payNowTask.isSuccess}
          >
            {t('upgrade_now')}
          </OLButton>
        </div>
      </PreviewLayout>
    )
  }

  const aiAddOnChange =
    preview.change.type === 'add-on-purchase' &&
    preview.change.addOn.code === 'assistant'

  const changeName =
    preview.change.type === 'add-on-purchase' ? preview.change.addOn.name : ''

  return (
    <PreviewLayout>
      {preview.change.type === 'add-on-purchase' ? (
        <h1>
          {t('add_add_on_to_your_plan', {
            addOnName: preview.change.addOn.name,
          })}
        </h1>
      ) : null}

      {payNowTask.isError && (
        <PaymentErrorNotification error={payNowTask.error as FetchError} />
      )}

      {aiAddOnChange && (
        <div>
          <Trans
            i18nKey="add_ai_assist_to_your_plan"
            components={{
              sparkle: (
                <img
                  alt="sparkle"
                  className="ai-error-assistant-sparkle"
                  src={sparkleText}
                  aria-hidden="true"
                  key="sparkle"
                />
              ),
            }}
          />
        </div>
      )}

      <OLCard className="payment-summary-card mt-5">
        <DueTodayBlock
          preview={preview}
          filteredLineItems={filteredLineItems}
          singleItemName={changeName}
        />
      </OLCard>

      <div className="mt-5">
        <Trans
          i18nKey="this_total_reflects_the_amount_due_until"
          values={{ date: moment(preview.nextInvoice.date).format('LL') }}
          components={{ strong: <strong /> }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
        />{' '}
        <Trans
          i18nKey="we_will_use_your_existing_payment_method"
          values={{ paymentMethod: preview.paymentMethod }}
          components={{ strong: <strong /> }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
        />
      </div>
      {aiAddOnChange && (
        <div className="plan-terms mt-3">*{t('fair_usage_policy_applies')}</div>
      )}

      <div className="mt-5">
        <OLButton
          variant="primary"
          size="lg"
          onClick={handlePayNowClick}
          disabled={payNowTask.isLoading || payNowTask.isSuccess}
        >
          {t('pay_now')}
        </OLButton>
      </div>

      <OLCard className="payment-summary-card mt-5">
        <h3>{t('future_payments')}:</h3>
        <FuturePayments preview={preview} />
      </OLCard>

      <NextPaymentDate preview={preview} />
    </PreviewLayout>
  )
}

async function payNow(preview: SubscriptionChangePreview) {
  const successPath =
    preview.change.type === 'premium-subscription'
      ? '/user/subscription/thank-you?upgrade=true'
      : '/user/subscription/thank-you'
  try {
    if (preview.change.type === 'add-on-purchase') {
      await postJSON(
        `/user/subscription/addon/${preview.change.addOn.code}/add`
      )
    } else if (preview.change.type === 'premium-subscription') {
      await postJSON(subscriptionUpdateUrl, {
        body: { plan_code: preview.change.plan.code },
      })
    } else {
      throw new Error(
        `Unknown subscription change preview type: ${preview.change}`
      )
    }
  } catch (e) {
    const { handled } = await handleStripePaymentAction(e as FetchError, {
      successPath,
    })
    if (!handled) {
      throw e
    }
  }
}

export default PreviewSubscriptionChange
