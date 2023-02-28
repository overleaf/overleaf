import { useTranslation } from 'react-i18next'
import { usePaymentContext } from '../../../context/payment-context'
import CurrencyDropdown from './currency-dropdown'

function PriceSummary() {
  const { t } = useTranslation()
  const {
    coupon,
    currencySymbol,
    recurlyPrice,
    planName,
    taxes,
    monthlyBilling,
  } = usePaymentContext()

  if (!recurlyPrice) {
    return null
  }

  const rate = parseFloat(taxes?.[0]?.rate)
  const subtotal =
    coupon?.normalPriceWithoutTax.toFixed(2) ?? recurlyPrice.subtotal

  return (
    <>
      <hr />
      <div className="price-summary" data-testid="price-summary">
        <h4>{t('payment_summary')}</h4>
        <div className="small">
          <div className="price-summary-line" data-testid="price-summary-plan">
            <span>{planName}</span>
            <span>
              {currencySymbol}
              {subtotal}
            </span>
          </div>
          {coupon && (
            <div
              className="price-summary-line"
              data-testid="price-summary-coupon"
            >
              <span>{coupon.name}</span>
              <span aria-hidden>
                &ndash;{currencySymbol}
                {recurlyPrice.discount}
              </span>
              <span className="sr-only">
                {t('discount_of', {
                  amount: `${currencySymbol}${recurlyPrice.discount}`,
                })}
              </span>
            </div>
          )}
          {rate > 0 && (
            <div className="price-summary-line" data-testid="price-summary-vat">
              <span>
                {t('vat')} {rate * 100}%
              </span>
              <span>
                {currencySymbol}
                {recurlyPrice.tax}
              </span>
            </div>
          )}
          <div
            className="price-summary-line price-summary-total-line"
            data-testid="price-summary-total"
          >
            <b>{monthlyBilling ? t('total_per_month') : t('total_per_year')}</b>
            <b>
              {currencySymbol}
              {recurlyPrice.total}
            </b>
          </div>
        </div>
        <div className="change-currency">
          <CurrencyDropdown id="change-currency-dropdown" />
        </div>
      </div>
    </>
  )
}

export default PriceSummary
