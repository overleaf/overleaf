import { Trans, useTranslation } from 'react-i18next'
import { FetchError, postJSON } from '../../../../infrastructure/fetch-json'
import {
  reactivateSubscriptionUrl,
  billingPortalUrl,
} from '../../data/subscription-url'
import useAsync from '../../../../shared/hooks/use-async'
import { useLocation } from '../../../../shared/hooks/use-location'
import getMeta from '../../../../utils/meta'
import { debugConsole } from '@/utils/debugging'
import OLButton from '@/shared/components/ol/ol-button'
import Notification from '@/shared/components/notification'
import GenericErrorAlert from './generic-error-alert'

function ReactivateSubscription() {
  const { t } = useTranslation()
  const { isLoading, isSuccess, isError, error, runAsync } = useAsync<
    void,
    FetchError
  >()
  const location = useLocation()

  const handleReactivate = () => {
    runAsync(postJSON(reactivateSubscriptionUrl)).catch(debugConsole.error)
  }

  if (isSuccess) {
    location.reload()
  }

  // Don't show the button to reactivate the subscription for managed users,
  // unless they are a managed group admin (who should be able to reactivate their own subscription)
  if (
    getMeta('ol-cannot-reactivate-subscription') &&
    !getMeta('ol-isManagedGroupAdmin')
  ) {
    return null
  }

  const isAddressPendingError = error?.data?.code === 'address_pending'

  return (
    <>
      {isError &&
        (isAddressPendingError ? (
          <div className="notification-list">
            <Notification
              aria-live="polite"
              type="error"
              content={
                <Trans
                  i18nKey="reactivate_subscription_valid_address_required"
                  components={[
                    /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
                    <a href={billingPortalUrl} />,
                  ]}
                />
              }
            />
          </div>
        ) : (
          <GenericErrorAlert />
        ))}
      <OLButton
        variant="primary"
        disabled={isLoading || isSuccess}
        onClick={handleReactivate}
        isLoading={isLoading}
        loadingLabel={t('reactivating')}
      >
        {t('reactivate_subscription')}
      </OLButton>
    </>
  )
}

export default ReactivateSubscription
