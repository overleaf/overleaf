import { useTranslation } from 'react-i18next'
import Collaborators from './collaborators'
import FeaturesList from './features-list'
import PriceSummary from './price-summary'
import TrialCouponSummary from './trial-coupon-summary'
import { usePaymentContext } from '../../../context/payment-context'

function PaymentPreviewPanel() {
  const { t } = useTranslation()
  const { plan, planName } = usePaymentContext()

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
      <TrialCouponSummary />
      <hr className="thin" />
      <p className="price-cancel-anytime text-center">{t('cancel_anytime')}</p>
    </div>
  )
}

export default PaymentPreviewPanel
