import { useCallback, useEffect, useState } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import { getJSON, postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import type { NotificationPreferencesSchema } from '../../../../../modules/notifications/app/src/types.ts'

export type NotificationLevel = 'all' | 'replies' | 'off'

/**
 * Map UI notification level to backend preferences
 */
function levelToPreferences(
  level: NotificationLevel
): NotificationPreferencesSchema {
  switch (level) {
    case 'all':
      return {
        trackedChangesOnOwnProject: true,
        trackedChangesOnInvitedProject: true,
        commentOnOwnProject: true,
        commentOnInvitedProject: true,
        repliesOnOwnProject: true,
        repliesOnInvitedProject: true,
        repliesOnAuthoredThread: true,
        repliesOnParticipatingThread: true,
      }
    case 'replies':
      return {
        trackedChangesOnOwnProject: false,
        trackedChangesOnInvitedProject: false,
        commentOnOwnProject: false,
        commentOnInvitedProject: false,
        repliesOnOwnProject: false,
        repliesOnInvitedProject: false,
        repliesOnAuthoredThread: true,
        repliesOnParticipatingThread: true,
      }
    case 'off':
      return {
        trackedChangesOnOwnProject: false,
        trackedChangesOnInvitedProject: false,
        commentOnOwnProject: false,
        commentOnInvitedProject: false,
        repliesOnOwnProject: false,
        repliesOnInvitedProject: false,
        repliesOnAuthoredThread: false,
        repliesOnParticipatingThread: false,
      }
  }
}

/**
 * Map backend preferences to UI notification level
 */
function preferencesToLevel(
  preferences: NotificationPreferencesSchema
): NotificationLevel {
  // If all notifications are off
  if (
    !preferences.commentOnOwnProject &&
    !preferences.commentOnInvitedProject &&
    !preferences.repliesOnOwnProject &&
    !preferences.repliesOnInvitedProject &&
    !preferences.repliesOnAuthoredThread &&
    !preferences.repliesOnParticipatingThread
  ) {
    return 'off'
  }

  // If only reply-related notifications are on
  if (
    !preferences.commentOnOwnProject &&
    !preferences.commentOnInvitedProject &&
    (preferences.repliesOnAuthoredThread ||
      preferences.repliesOnParticipatingThread)
  ) {
    return 'replies'
  }

  // Default to 'all' for any other combination
  return 'all'
}

export function useProjectNotificationPreferences() {
  const { projectId } = useProjectContext()
  const [notificationLevel, setNotificationLevel] =
    useState<NotificationLevel>('all')
  const [isLoading, setIsLoading] = useState(true)

  // Load preferences on mount
  useEffect(() => {
    getJSON<NotificationPreferencesSchema>(
      `/notifications/preferences/project/${projectId}`
    )
      .then(prefs => {
        setNotificationLevel(preferencesToLevel(prefs))
      })
      .catch(debugConsole.error)
      .finally(() => setIsLoading(false))
  }, [projectId])

  const setLevel = useCallback(
    (level: NotificationLevel) => {
      setNotificationLevel(level)
      const preferences = levelToPreferences(level)
      postJSON(`/notifications/preferences/project/${projectId}`, {
        body: preferences,
      }).catch(debugConsole.error)
    },
    [projectId]
  )

  return {
    notificationLevel,
    setNotificationLevel: setLevel,
    isLoading,
  }
}
