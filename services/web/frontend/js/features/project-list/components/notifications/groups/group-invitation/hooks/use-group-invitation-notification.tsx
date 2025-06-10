import {
  type Dispatch,
  type SetStateAction,
  useState,
  useCallback,
  useEffect,
} from 'react'
import type { NotificationGroupInvitation } from '../../../../../../../../../types/project/dashboard/notification'
import useAsync from '../../../../../../../shared/hooks/use-async'
import {
  FetchError,
  getJSON,
  postJSON,
  putJSON,
} from '../../../../../../../infrastructure/fetch-json'
import { useLocation } from '../../../../../../../shared/hooks/use-location'
import getMeta from '../../../../../../../utils/meta'
import useAsyncDismiss from '../../../hooks/useAsyncDismiss'
import { debugConsole } from '@/utils/debugging'

const SUCCESSFUL_NOTIF_TIME_BEFORE_HIDDEN = 10 * 1000

/* eslint-disable no-unused-vars */
export enum GroupInvitationStatus {
  Idle = 'Idle',
  CancelIndividualSubscription = 'CancelIndividualSubscription',
  AskToJoin = 'AskToJoin',
  SuccessfullyJoined = 'SuccessfullyJoined',
  NotificationIsHidden = 'NotificationIsHidden',
  Error = 'Error',
}
/* eslint-enable no-unused-vars */

type UseGroupInvitationNotificationReturnType = {
  isAcceptingInvitation: boolean
  groupInvitationStatus: GroupInvitationStatus
  setGroupInvitationStatus: Dispatch<SetStateAction<GroupInvitationStatus>>
  acceptGroupInvite: () => void
  cancelPersonalSubscription: () => void
  dismissGroupInviteNotification: () => void
  hideNotification: () => void
}

export function useGroupInvitationNotification(
  notification: NotificationGroupInvitation
): UseGroupInvitationNotificationReturnType {
  const { _id: notificationId } = notification
  const [groupInvitationStatus, setGroupInvitationStatus] =
    useState<GroupInvitationStatus>(GroupInvitationStatus.Idle)
  const { runAsync, isLoading } = useAsync<void, FetchError>()
  const { runAsync: runAsyncNotification, isLoading: isLoadingNotification } =
    useAsync<NotificationGroupInvitation, FetchError>()
  const location = useLocation()
  const { handleDismiss } = useAsyncDismiss()

  const hasIndividualPaidSubscription = getMeta(
    'ol-hasIndividualPaidSubscription'
  )

  useEffect(() => {
    if (hasIndividualPaidSubscription) {
      setGroupInvitationStatus(
        GroupInvitationStatus.CancelIndividualSubscription
      )
    } else {
      setGroupInvitationStatus(GroupInvitationStatus.AskToJoin)
    }
  }, [hasIndividualPaidSubscription])

  const acceptGroupInvite = useCallback(() => {
    // Fetch the latest notification data to ensure it's up-to-date
    runAsyncNotification(getJSON(`/user/notification/${notificationId}`))
      .then(notification => {
        const {
          messageOpts: { token, managedUsersEnabled },
        } = notification
        if (managedUsersEnabled) {
          location.assign(`/subscription/invites/${token}/`)
        } else {
          runAsync(
            putJSON(`/subscription/invites/${token}/`, {
              body: {
                _csrf: getMeta('ol-csrfToken'),
              },
            })
          )
            .then(() => {
              setGroupInvitationStatus(GroupInvitationStatus.SuccessfullyJoined)
            })
            .catch(err => {
              debugConsole.error(err)
              setGroupInvitationStatus(GroupInvitationStatus.Error)
            })
            .finally(() => {
              // remove notification automatically in the browser
              window.setTimeout(() => {
                setGroupInvitationStatus(
                  GroupInvitationStatus.NotificationIsHidden
                )
              }, SUCCESSFUL_NOTIF_TIME_BEFORE_HIDDEN)
            })
        }
      })
      .catch(debugConsole.error)
  }, [runAsync, runAsyncNotification, notificationId, location])

  const cancelPersonalSubscription = useCallback(() => {
    setGroupInvitationStatus(GroupInvitationStatus.AskToJoin)

    runAsync(postJSON('/user/subscription/cancel')).catch(debugConsole.error)
  }, [runAsync])

  const dismissGroupInviteNotification = useCallback(() => {
    if (notificationId) {
      handleDismiss(notificationId)
    }
  }, [handleDismiss, notificationId])

  const hideNotification = useCallback(() => {
    setGroupInvitationStatus(GroupInvitationStatus.NotificationIsHidden)
  }, [])

  const isAcceptingInvitation = isLoadingNotification || isLoading

  return {
    isAcceptingInvitation,
    groupInvitationStatus,
    setGroupInvitationStatus,
    acceptGroupInvite,
    cancelPersonalSubscription,
    dismissGroupInviteNotification,
    hideNotification,
  }
}
