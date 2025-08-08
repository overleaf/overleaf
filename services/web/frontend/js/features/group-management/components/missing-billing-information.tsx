import { Trans, useTranslation } from 'react-i18next'
import OLNotification from '@/shared/components/ol/ol-notification'
import Card from '@/features/group-management/components/card'

function MissingBillingInformation() {
  const { t } = useTranslation()

  return (
    <Card>
      <OLNotification
        type="error"
        title={t('missing_payment_details')}
        content={
          <Trans
            i18nKey="it_looks_like_your_payment_details_are_missing_please_update_your_billing_information"
            components={[
              // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
              <a
                href="/user/subscription/payment/billing-details"
                rel="noreferrer noopener"
              />,
              // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
              <a href="/contact" rel="noreferrer noopener" />,
            ]}
          />
        }
        className="m-0"
      />
    </Card>
  )
}

export default MissingBillingInformation
