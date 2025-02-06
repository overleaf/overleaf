import { Trans, useTranslation } from 'react-i18next'
import OLNotification from '@/features/ui/components/ol/ol-notification'
import Card from '@/features/group-management/components/card'

function ManuallyCollectedSubscription() {
  const { t } = useTranslation()

  return (
    <Card>
      <OLNotification
        type="error"
        title={t('account_billed_manually')}
        content={
          <Trans
            i18nKey="it_looks_like_your_account_is_billed_manually"
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
