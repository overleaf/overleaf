// Conditionally enable Sentry based on whether the DSN token is set
import getMeta from '../utils/meta'

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
          environment: window.ExposedSettings.sentryEnvironment,
          release: window.ExposedSettings.sentryRelease,
          autoSessionTracking: false,

          // Ignore errors unless they come from our origins
          // Adapted from: https://docs.sentry.io/platforms/javascript/#decluttering-sentry
          whitelistUrls: [
            new RegExp(window.ExposedSettings.sentryAllowedOriginRegex),
          ],

          ignoreErrors: [
            // Ignore very noisy error
            'SecurityError: Permission denied to access property "pathname" on cross-origin object',
            // Ignore unhandled error that is "expected" - see https://github.com/overleaf/issues/issues/3321
            /^Missing PDF/,
            /^pdfng error Error: MissingPDFException/,
            // Ignore "expected" error from aborted fetch - see https://github.com/overleaf/issues/issues/3321
            /^AbortError/,
            // Ignore spurious error from Ace internals - see https://github.com/overleaf/issues/issues/3321
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications.',
            // Microsoft Outlook SafeLink crawler
            // https://forum.sentry.io/t/unhandledrejection-non-error-promise-rejection-captured-with-value/14062
            /Non-Error promise rejection captured with value: Object Not Found Matching Id/,
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
          },
        })

        Sentry.setUser({ id: window.user_id })

        const splitTestAssignments = getMeta('ol-splitTestVariants')
        if (splitTestAssignments) {
          for (const [name, value] of Object.entries(splitTestAssignments)) {
            // Ensure Sentry tag name is within the 32-character limit
            Sentry.setTag(`ol.${name}`.slice(0, 32), value.toString())
          }
        }

        return Sentry
      })
      // If Sentry fails to load, use the null reporter instead
      .catch(error => {
        console.error(error)
        return nullReporter()
      })
  )
}

function nullReporter() {
  return Promise.resolve({
    captureException: console.error,
    captureMessage: console.error,
  })
}

export function captureException(...args) {
  reporterPromise.then(reporter => reporter.captureException(...args))
}

export function captureMessage(...args) {
  reporterPromise.then(reporter => reporter.captureMessage(...args))
}
