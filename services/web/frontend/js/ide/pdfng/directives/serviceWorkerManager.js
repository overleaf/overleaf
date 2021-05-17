let pendingWorkerSetup = Promise.resolve()

function supportsServiceWorker() {
  return 'serviceWorker' in navigator
}

export function waitForServiceWorker() {
  return pendingWorkerSetup
}

export function loadServiceWorker() {
  if (supportsServiceWorker()) {
    pendingWorkerSetup = navigator.serviceWorker
      .register('/serviceWorker.js', {
        scope: '/project/',
      })
      .catch(error => console.warn('Cannot register serviceWorker', error))
  }
}
