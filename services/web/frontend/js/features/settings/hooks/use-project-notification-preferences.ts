import { useCallback, useEffect, useState } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import { getJSON, postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import type {
  GlobalNotificationPreferencesSchema,
  NotificationPreferencesSchema,
} from '../../../../../modules/notifications/app/src/types.js'
import { sendMB } from '@/infrastructure/event-tracking'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { type PermissionsLevel } from '@/features/ide-react/types/permissions'

export type SettableNotificationLevel = 'all' | 'replies' | 'off'
export type NotificationLevel = SettableNotificationLevel | 'global-off'

/**
 * Map UI notification level to backend preferences
 */
function levelToPreferences(
  level: SettableNotificationLevel
): NotificationPreferencesSchema {
  switch (level) {
    case 'all':
      return {
        commentOnOwnProject: true,
        commentOnInvitedProject: true,
        repliesOnAuthoredThread: true,
        repliesOnParticipatingThread: true,
        commentResolvedOnAuthoredThread: true,
        commentResolvedOnParticipatingThread: true,
        commentReopenedOnAuthoredThread: true,
        commentReopenedOnParticipatingThread: true,
        trackedChangesOnOwnProject: true,
        trackedChangesOnInvitedProject: true,
        trackChangesAcceptedOnAuthoredChange: true,
        trackChangesRejectedOnAuthoredChange: true,
      }
    case 'replies':
      return {
        commentOnOwnProject: false,
        commentOnInvitedProject: false,
        repliesOnAuthoredThread: true,
        repliesOnParticipatingThread: true,
        commentResolvedOnAuthoredThread: true,
        commentResolvedOnParticipatingThread: true,
        commentReopenedOnAuthoredThread: true,
        commentReopenedOnParticipatingThread: true,
        trackedChangesOnOwnProject: false,
        trackedChangesOnInvitedProject: false,
        trackChangesAcceptedOnAuthoredChange: true,
        trackChangesRejectedOnAuthoredChange: true,
      }
    case 'off':
      return {
        commentOnOwnProject: false,
        commentOnInvitedProject: false,
        repliesOnAuthoredThread: false,
        repliesOnParticipatingThread: false,
        commentResolvedOnAuthoredThread: false,
        commentResolvedOnParticipatingThread: false,
        commentReopenedOnAuthoredThread: false,
        commentReopenedOnParticipatingThread: false,
        trackedChangesOnOwnProject: false,
        trackedChangesOnInvitedProject: false,
        trackChangesAcceptedOnAuthoredChange: false,
        trackChangesRejectedOnAuthoredChange: false,
      }
  }
}

/**
 * Map backend preferences to UI notification level, considering the user's
 * role so that only the relevant key variant is inspected.
 */
function preferencesToLevel(
  preferences: GlobalNotificationPreferencesSchema,
  permissionsLevel: PermissionsLevel
): NotificationLevel {
  if (preferences.muteAllNotifications) {
    return 'global-off'
  }

  const isOwner = permissionsLevel === 'owner'

  const projectComments = isOwner
    ? preferences.commentOnOwnProject
    : preferences.commentOnInvitedProject
  const projectTrackedChanges = isOwner
    ? preferences.trackedChangesOnOwnProject
    : preferences.trackedChangesOnInvitedProject

  const anyProjectNotifications = projectComments || projectTrackedChanges
  const anyParticipantNotifications =
    preferences.repliesOnAuthoredThread ||
    preferences.repliesOnParticipatingThread ||
    preferences.trackChangesAcceptedOnAuthoredChange ||
    preferences.trackChangesRejectedOnAuthoredChange ||
    preferences.commentResolvedOnAuthoredThread ||
    preferences.commentResolvedOnParticipatingThread ||
    preferences.commentReopenedOnAuthoredThread ||
    preferences.commentReopenedOnParticipatingThread

  if (!anyProjectNotifications && !anyParticipantNotifications) {
    return 'off'
  }

  if (!anyProjectNotifications && anyParticipantNotifications) {
    return 'replies'
  }

  return 'all'
}

export function useProjectNotificationPreferences() {
  const { projectId } = useProjectContext()
  const { permissionsLevel } = useIdeReactContext()
  const [notificationLevel, setNotificationLevel] =
    useState<NotificationLevel>('all')
  const [isLoading, setIsLoading] = useState(true)

  // Load preferences on mount
  useEffect(() => {
    getJSON<GlobalNotificationPreferencesSchema>(
      `/notifications/preferences/project/${projectId}`
    )
      .then(prefs => {
        setNotificationLevel(preferencesToLevel(prefs, permissionsLevel))
      })
      .catch(debugConsole.error)
      .finally(() => setIsLoading(false))
  }, [projectId, permissionsLevel])

  const setLevel = useCallback(
    (level: SettableNotificationLevel) => {
      setNotificationLevel(level)
      const preferences = levelToPreferences(level)
      sendMB('setting-changed', {
        changedSetting: 'projectEmailNotifications',
        changedSettingVal: level,
        projectRole: permissionsLevel,
      })
      postJSON(`/notifications/preferences/project/${projectId}`, {
        body: preferences,
      }).catch(debugConsole.error)
    },
    [projectId, permissionsLevel]
  )

  return {
    notificationLevel,
    setNotificationLevel: setLevel,
    isLoading,
  }
}
