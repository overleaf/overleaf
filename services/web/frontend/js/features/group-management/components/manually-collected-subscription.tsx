import { Trans, useTranslation } from 'react-i18next'
import OLNotification from '@/features/ui/components/ol/ol-notification'
import Card from '@/features/group-management/components/card'
import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function ManuallyCollectedSubscription() {
  const { t } = useTranslation()
  const isFlexibleGroupLicensingForManuallyBilledSubscriptions = useFeatureFlag(
    'flexible-group-licensing-for-manually-billed-subscriptions'
  )

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
          isFlexibleGroupLicensingForManuallyBilledSubscriptions ? (
            <Trans
              i18nKey="it_looks_like_your_account_is_billed_manually_upgrading_subscription"
              components={[
                // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                <a href="/contact" rel="noreferrer noopener" />,
              ]}
            />
          ) : (
            <Trans
              i18nKey="it_looks_like_your_account_is_billed_manually"
              components={[
                // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                <a href="/contact" rel="noreferrer noopener" />,
              ]}
            />
          )
        }
        className="m-0"
      />
    </Card>
  )
}

export default ManuallyCollectedSubscription
