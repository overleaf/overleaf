import { Trans, useTranslation } from 'react-i18next'
import OLNotification from '@/shared/components/ol/ol-notification'
import Card from '@/features/group-management/components/card'
import getMeta from '@/utils/meta'

function ManuallyCollectedSubscription() {
  const { t } = useTranslation()
  const errorType = getMeta('ol-errorType')

  return (
    <Card>
      <OLNotification
        type="error"
        title={t('account_billed_manually')}
        content={
          errorType === 'plan-upgrade' ? (
            <Trans
              i18nKey="it_looks_like_your_account_is_billed_manually_upgrading_subscription"
              components={[
                // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                <a href="/contact" rel="noreferrer noopener" />,
              ]}
            />
          ) : (
            <Trans
              i18nKey="it_looks_like_your_account_is_billed_manually_purchasing_additional_license_or_upgrading_subscription"
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
