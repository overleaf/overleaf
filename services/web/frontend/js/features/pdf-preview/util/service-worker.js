import { captureException } from '../../../infrastructure/error-reporter'
const OError = require('@overleaf/o-error')

let pendingWorkerSetup = Promise.resolve()

function supportsServiceWorker() {
  return 'serviceWorker' in navigator
}

export function waitForServiceWorker() {
  return pendingWorkerSetup
}

export function loadServiceWorker(options) {
  if (supportsServiceWorker()) {
    const workerSetup = navigator.serviceWorker
      .register('/serviceWorker.js', {
        scope: '/project/',
      })
      .then(() => {
        navigator.serviceWorker.addEventListener('message', event => {
          let ctx
          try {
            ctx = JSON.parse(event.data)
          } catch (e) {
            return
          }
          if (!ctx || !ctx.error || !ctx.extra) return

          const err = OError.tag(ctx.error, 'Error in serviceWorker')
          const fullError = new Error()
          fullError.name = err.name
          fullError.message = err.message
          fullError.stack = OError.getFullStack(err)
          captureException(fullError, { extra: ctx.extra })
        })
      })
      .catch(error =>
        captureException(OError.tag(error, 'Cannot register serviceWorker'))
      )
    if (options && options.timeout > 0) {
      const workerTimeout = new Promise(resolve => {
        setTimeout(resolve, options.timeout)
      })
      pendingWorkerSetup = Promise.race([workerSetup, workerTimeout])
    } else {
      pendingWorkerSetup = workerSetup
    }
  }
}

export function unregisterServiceWorker() {
  if (supportsServiceWorker()) {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'disable',
      })
    }

    navigator.serviceWorker
      .getRegistrations()
      .catch(error => {
        // fail silently if permission not given (e.g. SecurityError)
        console.error('error listing service worker registrations', error)
        return []
      })
      .then(registrations => {
        registrations.forEach(worker => {
          worker.unregister()
        })
      })
  }
}
