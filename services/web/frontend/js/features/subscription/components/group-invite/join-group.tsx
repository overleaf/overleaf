import { Dispatch, SetStateAction, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { InviteViewTypes } from './group-invite'
import getMeta from '@/utils/meta'
import { FetchError, putJSON } from '@/infrastructure/fetch-json'
import useAsync from '@/shared/hooks/use-async'
import classNames from 'classnames'
import { debugConsole } from '@/utils/debugging'
import Notification from '@/shared/components/notification'
import OLButton from '@/features/ui/components/ol/ol-button'

export default function JoinGroup({
  setView,
}: {
  setView: Dispatch<SetStateAction<InviteViewTypes>>
}) {
  const { t } = useTranslation()
  const expired = getMeta('ol-expired')
  const inviteToken = getMeta('ol-inviteToken')
  const {
    runAsync,
    isLoading: isJoining,
    isError,
  } = useAsync<never, FetchError>()

  const notNowBtnClasses = classNames(
    'btn',
    'btn-secondary',
    isJoining ? 'disabled' : ''
  )

  const joinTeam = useCallback(() => {
    runAsync(putJSON(`/subscription/invites/${inviteToken}`))
      .then(() => {
        setView('invite-accepted')
      })
      .catch(debugConsole.error)
  }, [inviteToken, runAsync, setView])

  if (!inviteToken) {
    return null
  }

  return (
    <>
      {isError && (
        <Notification
          type="error"
          content={t('generic_something_went_wrong')}
          className="my-3"
        />
      )}

      <div className="text-center">
        <p>{t('join_team_explanation')}</p>
        {!expired && (
          <p>
            <a className={notNowBtnClasses} href="/project">
              {t('not_now')}
            </a>
            &nbsp;&nbsp;
            <OLButton
              variant="primary"
              onClick={() => joinTeam()}
              disabled={isJoining}
            >
              {t('accept_invitation')}
            </OLButton>
          </p>
        )}
      </div>
    </>
  )
}
