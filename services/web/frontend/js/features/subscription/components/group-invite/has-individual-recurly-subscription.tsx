import { FetchError, postJSON } from '@/infrastructure/fetch-json'
import Notification from '@/shared/components/notification'
import useAsync from '@/shared/hooks/use-async'
import { debugConsole } from '@/utils/debugging'
import getMeta from '@/utils/meta'
import { Dispatch, SetStateAction, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { InviteViewTypes } from './group-invite'
import OLButton from '@/shared/components/ol/ol-button'

export default function HasIndividualRecurlySubscription({
  setView,
}: {
  setView: Dispatch<SetStateAction<InviteViewTypes>>
}) {
  const { t } = useTranslation()
  const {
    runAsync,
    isLoading: isCancelling,
    isError,
  } = useAsync<never, FetchError>()

  const cancelPersonalSubscription = useCallback(() => {
    runAsync(
      postJSON('/user/subscription/cancel', {
        body: {
          _csrf: getMeta('ol-csrfToken'),
        },
      })
    )
      .then(() => {
        setView('invite')
      })
      .catch(debugConsole.error)
  }, [runAsync, setView])

  return (
    <>
      {isError && (
        <Notification
          type="error"
          content={t('something_went_wrong_canceling_your_subscription')}
          className="my-3"
        />
      )}

      <div className="text-center">
        <p>{t('cancel_personal_subscription_first')}</p>
        <p>
          <OLButton
            variant="secondary"
            disabled={isCancelling}
            onClick={() => setView('invite')}
          >
            {t('not_now')}
          </OLButton>
          &nbsp;&nbsp;
          <OLButton
            variant="primary"
            disabled={isCancelling}
            onClick={() => cancelPersonalSubscription()}
          >
            {t('cancel_your_subscription')}
          </OLButton>
        </p>
      </div>
    </>
  )
}
