import { useTranslation } from 'react-i18next'
import { usePaymentContext } from '../../../context/payment-context'

function NoDiscountPrice() {
  const { t } = useTranslation()
  const { currencySymbol, monthlyBilling, coupon } = usePaymentContext()

  if (coupon?.normalPrice === undefined) {
    return null
  }

  const price = `${currencySymbol}${coupon.normalPrice.toFixed(2)}`

  return (
    <div>
      {!coupon.singleUse &&
        coupon.discountMonths &&
        coupon.discountMonths > 0 &&
        monthlyBilling &&
        t('then_x_price_per_month', { price })}
      {!coupon.singleUse &&
        !coupon.discountMonths &&
        monthlyBilling &&
        t('normally_x_price_per_month', { price })}
      {!coupon.singleUse &&
        !monthlyBilling &&
        t('normally_x_price_per_year', { price })}
      {coupon.singleUse &&
        monthlyBilling &&
        t('then_x_price_per_month', { price })}
      {coupon.singleUse &&
        !monthlyBilling &&
        t('then_x_price_per_year', { price })}
    </div>
  )
}

export default NoDiscountPrice
