import { useTranslation } from 'react-i18next'
import { postJSON } from '../../../../infrastructure/fetch-json'
import { reactivateSubscriptionUrl } from '../../data/subscription-url'
import useAsync from '../../../../shared/hooks/use-async'
import { useLocation } from '../../../../shared/hooks/use-location'

function ReactivateSubscription() {
  const { t } = useTranslation()
  const { isLoading, isSuccess, runAsync } = useAsync()
  const location = useLocation()

  const handleReactivate = () => {
    runAsync(postJSON(reactivateSubscriptionUrl)).catch(console.error)
  }

  if (isSuccess) {
    location.reload()
  }

  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={isLoading || isSuccess}
      onClick={handleReactivate}
    >
      {t('reactivate_subscription')}
    </button>
  )
}

export default ReactivateSubscription
