import { Trans, useTranslation } from 'react-i18next'
import OLNotification from '@/shared/components/ol/ol-notification'
import Card from '@/features/group-management/components/card'
import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'

function ManuallyCollectedSubscription() {
  const { t } = useTranslation()
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return (
    <Card>
      <OLNotification
        type="error"
        title={t('account_billed_manually')}
        content={
          <Trans
            i18nKey="it_looks_like_your_account_is_billed_manually_purchasing_additional_license_or_upgrading_subscription"
            components={[
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

export default ManuallyCollectedSubscription
