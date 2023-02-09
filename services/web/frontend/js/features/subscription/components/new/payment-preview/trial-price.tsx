import { Trans } from 'react-i18next'
import { usePaymentContext } from '../../../context/payment-context'

function TrialPrice() {
  const { currencySymbol, trialLength, recurlyPrice } = usePaymentContext()

  if (!trialLength || !recurlyPrice) {
    return null
  }

  return (
    <div>
      <Trans
        i18nKey="first_x_days_free_after_that_y_per_month"
        components={[<strong />, <strong />]} // eslint-disable-line react/jsx-key
        values={{
          trialLen: trialLength,
          price: `${currencySymbol}${recurlyPrice.total}`,
        }}
      />
    </div>
  )
}

export default TrialPrice
