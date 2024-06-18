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
  const {
    _id: notificationId,
    messageOpts: { token, managedUsersEnabled },
  } = notification

  const [groupInvitationStatus, setGroupInvitationStatus] =
    useState<GroupInvitationStatus>(GroupInvitationStatus.Idle)
  const { runAsync, isLoading: isAcceptingInvitation } = useAsync<
    never,
    FetchError
  >()
  const location = useLocation()
  const { handleDismiss } = useAsyncDismiss()

  const hasIndividualRecurlySubscription = getMeta(
    'ol-hasIndividualRecurlySubscription'
  )

  useEffect(() => {
    if (hasIndividualRecurlySubscription) {
      setGroupInvitationStatus(
        GroupInvitationStatus.CancelIndividualSubscription
      )
    } else {
      setGroupInvitationStatus(GroupInvitationStatus.AskToJoin)
    }
  }, [hasIndividualRecurlySubscription])

  const acceptGroupInvite = useCallback(() => {
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
            setGroupInvitationStatus(GroupInvitationStatus.NotificationIsHidden)
          }, SUCCESSFUL_NOTIF_TIME_BEFORE_HIDDEN)
        })
    }
  }, [runAsync, token, location, managedUsersEnabled])

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
