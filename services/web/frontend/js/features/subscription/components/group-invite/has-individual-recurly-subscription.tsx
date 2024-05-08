import { FetchError, postJSON } from '@/infrastructure/fetch-json'
import Notification from '@/shared/components/notification'
import useAsync from '@/shared/hooks/use-async'
import { debugConsole } from '@/utils/debugging'
import getMeta from '@/utils/meta'
import { Dispatch, SetStateAction, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { InviteViewTypes } from './group-invite'

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
          <button
            className="btn btn-secondary"
            disabled={isCancelling}
            onClick={() => setView('invite')}
          >
            {t('not_now')}
          </button>
          &nbsp;&nbsp;
          <button
            className="btn btn-primary"
            disabled={isCancelling}
            onClick={() => {
              cancelPersonalSubscription()
            }}
          >
            {t('cancel_your_subscription')}
          </button>
        </p>
      </div>
    </>
  )
}
