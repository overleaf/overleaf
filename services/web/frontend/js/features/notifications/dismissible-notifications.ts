import getMeta from '@/utils/meta'

const KEY_PREFIX = 'readnotif-'

function setDismissedNotification(dismissId: string, cookiePaths: string[]) {
  const name = `${KEY_PREFIX}${dismissId}`
  const cookieDomain = getMeta('ol-ExposedSettings').cookieDomain
  const oneYearInSeconds = 60 * 60 * 24 * 365

  for (const path of cookiePaths) {
    const cookieAttributes =
      `; path=${path}` +
      '; domain=' +
      cookieDomain +
      '; max-age=' +
      oneYearInSeconds +
      '; SameSite=Lax; Secure'
    document.cookie = `${name}=1;${cookieAttributes}`
  }
}

function hydrateDismissibleNotification(notification: HTMLElement) {
  const dismissId = notification.dataset.olDismissId
  if (!dismissId) return

  if (!notification.dataset.olDismissCookiePaths) {
    throw new Error(
      `Dismissible notifications must have a data-ol-dismiss-cookie-paths attribute ("${dismissId}").`
    )
  }

  const dismissCookiePaths =
    notification.dataset.olDismissCookiePaths.split(',')

  const dismissButton = notification.querySelector<HTMLButtonElement>(
    '[data-ol-dismiss-button]'
  )

  if (dismissButton) {
    dismissButton.addEventListener('click', () => {
      setDismissedNotification(dismissId, dismissCookiePaths)
      notification.hidden = true
    })
  }
}

document
  .querySelectorAll<HTMLElement>('[data-ol-dismiss-id]')
  .forEach(hydrateDismissibleNotification)
