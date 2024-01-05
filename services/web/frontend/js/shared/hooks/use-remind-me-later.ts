import { useState, useCallback, useEffect } from 'react'
import customLocalStorage from '@/infrastructure/local-storage'
import usePersistedState from '@/shared/hooks/use-persisted-state'

/**
 * @typedef {Object} RemindMeLater
 * @property {boolean} stillDissmissed - whether the user has dismissed the notification, or if the notification is still withing the 1 day reminder period
 * @property {function} remindThemLater - saves that the user has dismissed the notification for 1 day in local storage
 * @property {function} saveDismissed - saves that the user has dismissed the notification in local storage
 */

/**
 *
 * @param {string} key the unique key used to keep track of what popup is currently being shown (usually the component name)
 * @param {string} notificationLocation what page the notification originates from (eg, the editor page, project page, etc)
 * @returns {RemindMeLater} an object containing whether the notification is still dismissed, and functions to remind the user later or save that they have dismissed the notification
 */
export default function useRemindMeLater(
  key: string,
  notificationLocation: string = 'editor'
) {
  const [dismissedUntil, setDismissedUntil] = usePersistedState<
    Date | undefined
  >(`${notificationLocation}.has_dismissed_${key}_until`)

  const [stillDissmissed, setStillDismissed] = useState(true)

  useEffect(() => {
    const alertDismissed = customLocalStorage.getItem(
      `${notificationLocation}.has_dismissed_${key}`
    )

    const isStillDismissed = Boolean(
      dismissedUntil && new Date(dismissedUntil) > new Date()
    )

    setStillDismissed(alertDismissed || isStillDismissed)
  }, [setStillDismissed, dismissedUntil, key, notificationLocation])

  const remindThemLater = useCallback(() => {
    const until = new Date()
    until.setDate(until.getDate() + 1) // 1 day
    setDismissedUntil(until)
  }, [setDismissedUntil])

  const saveDismissed = useCallback(() => {
    customLocalStorage.setItem(
      `${notificationLocation}.has_dismissed_${key}`,
      true
    )
  }, [key, notificationLocation])

  return { stillDissmissed, remindThemLater, saveDismissed }
}
