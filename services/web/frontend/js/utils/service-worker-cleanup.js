export function cleanupServiceWorker() {
  try {
    navigator.serviceWorker
      .getRegistrations()
      .catch(() => {
        // fail silently if permission not given (e.g. SecurityError)
        return []
      })
      .then(registrations => {
        registrations.forEach(worker => {
          worker.unregister()
        })
      })
  } catch (e) {
    // fail silently if service worker are not available (on the navigator)
  }
}
