import { useTranslation } from 'react-i18next'
import { RecurlySubscription } from '../../../../../../types/subscription/dashboard/subscription'

type PriceExceptionsProps = {
  subscription: RecurlySubscription
}

export function PriceExceptions({ subscription }: PriceExceptionsProps) {
  const { t } = useTranslation()
  const { activeCoupons } = subscription.recurly

  return (
    <>
      <p>
        <i>* {t('subject_to_additional_vat')}</i>
      </p>
      {activeCoupons.length > 0 && (
        <>
          <i>* {t('coupons_not_included')}:</i>
          <ul>
            {activeCoupons.map(coupon => (
              <li key={coupon.id}>
                <i>{coupon.description || coupon.name}</i>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
