import '@/marketing'
import {
  inflightHelper,
  toggleDisplay,
} from '@/features/form-helpers/hydrate-form'
import getMeta from '@/utils/meta'
import { Socket } from '@/features/ide-react/connection/types/socket'

declare const io: {
  connect: (url: string | null, options?: Record<string, unknown>) => Socket
}

interface ConnectionRejectedError {
  code?: string
  message?: string
}

function setUpStatusIndicator(el: HTMLElement, fn: () => Promise<void>) {
  inflightHelper(el)

  const displaySuccess = el.querySelectorAll<HTMLElement>(
    '[data-ol-result="success"]'
  )
  const displayError = el.querySelectorAll<HTMLElement>(
    '[data-ol-result="error"]'
  )

  // The checks are very lightweight and do not appear to do anything
  //  from looking at the UI. Add an artificial delay of 1s to show that
  //  we are actually doing something. :)
  const artificialProgressDelay = 1000

  function run() {
    setTimeout(() => {
      fn()
        .then(() => {
          toggleDisplay(displayError, displaySuccess)
        })
        .catch(error => {
          const errorElement = el.querySelector('[data-ol-error]')
          if (errorElement) {
            errorElement.textContent = error.message
          }
          toggleDisplay(displaySuccess, displayError)
        })
        .finally(() => {
          el.dispatchEvent(new Event('idle'))
        })
    }, artificialProgressDelay)
  }

  el.querySelectorAll('button').forEach(retryBtn => {
    retryBtn.addEventListener('click', function (e) {
      e.preventDefault()
      el.dispatchEvent(new Event('pending'))
      run()
    })
  })

  run()
}

function setUpStatusIndicators() {
  const launchpadCheckElement = document.querySelector<HTMLElement>(
    '[data-ol-launchpad-check="websocket"]'
  )

  if (!launchpadCheckElement) {
    return
  }

  setUpStatusIndicator(launchpadCheckElement, () => {
    const timeout = 10 * 1000
    const socket = io.connect(null, {
      reconnect: false,
      'connect timeout': timeout,
      'force new connection': true,
      query: new URLSearchParams({
        projectId: '404404404404404404404404',
      }).toString(),
    })
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => reject(new Error('timed out')), timeout)
      socket.on('connectionRejected', function (err?: ConnectionRejectedError) {
        if (err?.code === 'ProjectNotFound') {
          // We received the response from joinProject, so the websocket is up.
          resolve()
        } else {
          reject(new Error(err && err.message))
        }
      })
      socket.on('connect_failed', function (err?: Error) {
        reject(new Error(err && err.message))
      })
    }).finally(() => {
      socket.disconnect()
    })
  })
}

if (getMeta('ol-adminUserExists')) {
  setUpStatusIndicators()
}
