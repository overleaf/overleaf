import { useTranslation } from 'react-i18next'
import Collaborators from './collaborators'
import FeaturesList from './features-list'
import PriceSummary from './price-summary'
import TrialPrice from './trial-price'
import NoDiscountPrice from './no-discount-price'
import PriceForFirstXPeriod from './price-for-first-x-period'
import { usePaymentContext } from '../../../context/payment-context'

function PaymentPreviewPanel() {
  const { t } = useTranslation()
  const { plan, planName } = usePaymentContext()
  const trialPrice = <TrialPrice />
  const priceForFirstXPeriod = <PriceForFirstXPeriod />
  const noDiscountPrice = <NoDiscountPrice />

  return (
    <div className="price-feature-description">
      <h4>{planName}</h4>
      {plan.features && (
        <>
          <Collaborators count={plan.features.collaborators} />
          <FeaturesList features={plan.features} />
        </>
      )}
      <PriceSummary />
      {(trialPrice || priceForFirstXPeriod || noDiscountPrice) && (
        <>
          <hr className="thin" />
          <div className="trial-coupon-summary">
            {trialPrice}
            {priceForFirstXPeriod}
            {noDiscountPrice}
          </div>
        </>
      )}
      <hr className="thin" />
      <p className="price-cancel-anytime text-center">{t('cancel_anytime')}</p>
    </div>
  )
}

export default PaymentPreviewPanel
