import { useTranslation } from 'react-i18next'
import { PaidSubscription } from '../../../../../../types/subscription/dashboard/subscription'

type PriceExceptionsProps = {
  subscription: PaidSubscription
}

export function PriceExceptions({ subscription }: PriceExceptionsProps) {
  const { t } = useTranslation()
  const { activeCoupons } = subscription.payment

  return (
    <>
      <p>
        <i>* {t('subject_to_additional_vat')}</i>
      </p>
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
