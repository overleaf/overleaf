// Conditionally enable Sentry based on whether the DSN token is set
const reporterPromise = window.ExposedSettings.sentryDsn
  ? sentryReporter()
  : nullReporter()

function sentryReporter() {
  return (
    import(/* webpackMode: "eager" */ '@sentry/browser')
      .then(Sentry => {
        let eventCount = 0

        Sentry.init({
          dsn: window.ExposedSettings.sentryDsn,
          release: window.ExposedSettings.sentryRelease,

          // Ignore errors unless they come from our origins
          // Adapted from: https://docs.sentry.io/platforms/javascript/#decluttering-sentry
          whitelistUrls: [
            new RegExp(window.ExposedSettings.sentryAllowedOriginRegex)
          ],

          ignoreErrors: [
            // Ignore very noisy error
            'SecurityError: Permission denied to access property "pathname" on cross-origin object',
            // Ignore unhandled error that is "expected" - see https://github.com/overleaf/issues/issues/3321
            /^Missing PDF/,
            // Ignore "expected" error from aborted fetch - see https://github.com/overleaf/issues/issues/3321
            /^AbortError/,
            // Ignore spurious error from Ace internals - see https://github.com/overleaf/issues/issues/3321
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications.'
          ],

          beforeSend(event) {
            // Limit number of events sent to Sentry to 100 events "per page load",
            // (i.e. the cap will be reset if the page is reloaded). This prevent
            // hitting their server-side event cap.
            eventCount++
            if (eventCount > 100) {
              return null // Block the event from sending
            } else {
              return event
            }
          }
        })

        Sentry.setUser({ id: window.user_id })

        return Sentry
      })
      // If Sentry fails to load, use the null reporter instead
      .catch(nullReporter)
  )
}

function nullReporter() {
  return Promise.resolve({
    captureException: error => {
      console.error(error)
    },
    captureMessage: error => {
      console.error(error)
    }
  })
}

export function captureException(...args) {
  reporterPromise.then(reporter => reporter.captureException(...args))
}

export function captureMessage(...args) {
  reporterPromise.then(reporter => reporter.captureMessage(...args))
}
