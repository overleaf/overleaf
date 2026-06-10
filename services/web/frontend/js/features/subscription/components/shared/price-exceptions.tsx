import { useTranslation } from 'react-i18next'
import { PaidSubscription } from '../../../../../../types/subscription/dashboard/subscription'

type PriceExceptionsProps = {
  subscription: PaidSubscription
}

export function PriceExceptions({ subscription }: PriceExceptionsProps) {
  const { t } = useTranslation()
  const { activeCoupons, taxRate } = subscription.payment

  return (
    <>
      {!(taxRate > 0) && (
        <p>
          <i>* {t('taxes_may_be_added')}</i>
        </p>
      )}
      {activeCoupons.length > 0 && (
        <>
          <i>* {t('coupons_not_included')}:</i>
          <ul data-testid="active-coupons">
            {activeCoupons.map(coupon => (
              <li key={coupon.code}>
                <i>{coupon.description || coupon.name}</i>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
