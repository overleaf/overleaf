import { Trans } from 'react-i18next'
import { usePaymentContext } from '../../../context/payment-context'

function PriceForFirstXPeriod() {
  const { currencySymbol, monthlyBilling, coupon, recurlyPrice } =
    usePaymentContext()

  if (!recurlyPrice || !coupon) {
    return null
  }

  const price = `${currencySymbol}${recurlyPrice.total}`

  return (
    <div>
      {coupon.discountMonths &&
        coupon.discountMonths > 0 &&
        !coupon.singleUse &&
        monthlyBilling && (
          <Trans
            i18nKey="x_price_for_y_months"
            components={[<strong />]} // eslint-disable-line react/jsx-key
            values={{
              discountMonths: coupon.discountMonths,
              price,
            }}
          />
        )}
      {coupon.singleUse && monthlyBilling && (
        <Trans
          i18nKey="x_price_for_first_month"
          components={[<strong />]} // eslint-disable-line react/jsx-key
          values={{ price }}
        />
      )}
      {coupon.singleUse && !monthlyBilling && (
        <div>
          <Trans
            i18nKey="x_price_for_first_year"
            components={[<strong />]} // eslint-disable-line react/jsx-key
            values={{ price }}
          />
        </div>
      )}
    </div>
  )
}

export default PriceForFirstXPeriod
