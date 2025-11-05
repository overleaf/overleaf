import '../../../../stylesheets/components/compile-time-paywall-modal.scss'

import {
  OLModal,
  OLModalBody,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import BillingPeriodToggle, {
  type BillingPeriod,
} from '@/shared/components/billing-period-toggle'
import getMeta from '@/utils/meta'
import { sendMB } from '@/infrastructure/event-tracking'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const PLAN_CODE = {
  monthly: 'collaborator',
  annual: 'collaborator-annual',
} as const

export type CompileTimeoutPaywallModalProps = {
  show: boolean
  onHide: () => void
}

export function CompileTimeoutPaywallModal({
  show,
  onHide,
}: CompileTimeoutPaywallModalProps) {
  const { t } = useTranslation()
  const standardPlanPricing = getMeta('ol-standardPlanPricing')
  const currency = getMeta('ol-recommendedCurrency')

  const supportsAnnualPricing = Boolean(standardPlanPricing?.annual)
  const [annual, setAnnual] = useState(false)

  useEffect(() => {
    if (!show) {
      setAnnual(false)
    }
  }, [show])

  const billingPeriod: BillingPeriod = annual ? 'annual' : 'monthly'
  const planCode = PLAN_CODE[billingPeriod]

  const hasShownRef = useRef(false)
  useEffect(() => {
    if (show && !hasShownRef.current) {
      const countryCode = getMeta('ol-countryCode')

      sendMB('paywall-plans-page-view', {
        currency,
        countryCode,
        version: 'compile-timeout',
      })

      hasShownRef.current = true
    } else if (!show) {
      hasShownRef.current = false
    }
  }, [show, currency])

  const handleToggleBilling = useCallback(() => {
    const nextAnnual = !annual
    setAnnual(nextAnnual)
    sendMB('paywall-plans-page-toggle', {
      'billing-period': nextAnnual ? 'annual' : 'monthly',
      checked: nextAnnual ? 'checked' : 'unchecked',
      version: 'compile-timeout',
    })
  }, [annual])

  const openCheckout = useCallback(() => {
    const params = new URLSearchParams({
      itm_campaign: 'compile-timeout',
    })

    window.open(
      `/user/subscription/new?planCode=${planCode}&${params.toString()}`,
      '_blank',
      'noopener,noreferrer'
    )
  }, [planCode])

  const handleUpgrade = useCallback(() => {
    sendMB('paywall-plans-page-click', {
      plan: 'collaborator',
      'billing-period': billingPeriod,
      currency,
      version: 'compile-timeout',
      button: 'buy',
    })
    openCheckout()
  }, [billingPeriod, currency, openCheckout])

  const viewAllPlansHref = useMemo(() => {
    const params = new URLSearchParams({
      itm_campaign: 'compile-timeout',
    })
    return `/user/subscription/choose-your-plan?${params.toString()}`
  }, [])

  const handleViewAllPlans = useCallback(() => {
    sendMB('paywall-plans-page-click', {
      button: 'plans',
      'billing-period': billingPeriod,
      currency,
      version: 'compile-timeout',
    })
  }, [billingPeriod, currency])

  const price = annual
    ? standardPlanPricing?.annual
    : standardPlanPricing?.monthly

  const priceSubtext = annual ? t('per_year') : t('per_month')

  const strikethroughPrice = annual
    ? standardPlanPricing?.monthlyTimesTwelve
    : undefined

  return (
    <OLModal
      className="compile-time-paywall-modal"
      size="sm"
      show={show}
      onHide={onHide}
      centered
    >
      <OLModalHeader className="border-0 pb-0" closeButton>
        <div className="w-100 text-center">
          <OLModalTitle>{t('get_more_compile_time')}</OLModalTitle>
        </div>
      </OLModalHeader>

      <OLModalBody>
        <div className="compile-time-paywall-card">
          <div className="compile-time-paywall-header">
            <div className="compile-time-paywall-plan-meta">
              <p className="compile-time-paywall-plan-label">
                {t('standard')} {t('plan')}
              </p>
              <div className="compile-time-paywall-price-container">
                {strikethroughPrice ? (
                  <span className="compile-time-paywall-price-strikethrough">
                    {strikethroughPrice}
                  </span>
                ) : (
                  <span
                    className="compile-time-paywall-price-strikethrough"
                    style={{ visibility: 'hidden' }}
                    aria-hidden="true"
                  >
                    &nbsp;
                  </span>
                )}
                <span className="compile-time-paywall-price">{price}</span>
                {priceSubtext && (
                  <span className="compile-time-paywall-price-subtext">
                    {priceSubtext}
                  </span>
                )}
              </div>
            </div>

            {supportsAnnualPricing && (
              <div className="compile-time-paywall-period-toggle">
                <BillingPeriodToggle
                  id="compile-timeout-period"
                  value={annual ? 'annual' : 'monthly'}
                  onChange={(period: BillingPeriod) => {
                    if ((period === 'annual') !== annual) {
                      handleToggleBilling()
                    }
                  }}
                  variant="premium"
                />
              </div>
            )}
          </div>

          <div className="compile-time-paywall-body">
            <div className="compile-time-paywall-illustration">
              <MaterialIcon type="rocket_launch" />
            </div>
            <div className="compile-time-paywall-content">
              <p className="compile-time-paywall-intro">
                <strong>{t('compile_timeout_modal_intro')}</strong>
              </p>
              <div className="compile-time-paywall-feature-list">
                <ListItem>
                  {t('collabs_per_proj', { collabcount: 10 })}
                </ListItem>
                <ListItem>{t('track_changes')}</ListItem>
                <ListItem>{t('github_integration')}</ListItem>
                <ListItem>{t('and_much_more')}</ListItem>
              </div>
            </div>
          </div>

          <div className="compile-time-paywall-actions">
            <OLButton
              variant="premium"
              type="button"
              size="lg"
              onClick={handleUpgrade}
            >
              {t('buy_now_no_exclamation_mark')}
            </OLButton>

            <OLButton
              className="compile-time-paywall-view-plans"
              variant="ghost"
              href={viewAllPlansHref}
              target="_blank"
              rel="noreferrer"
              onClick={handleViewAllPlans}
            >
              {t('view_all_plans')}
            </OLButton>
          </div>
        </div>
      </OLModalBody>
    </OLModal>
  )
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="compile-time-paywall-list-item">
      <MaterialIcon type="check_circle" />
      <span>{children}</span>
    </div>
  )
}

export default CompileTimeoutPaywallModal
