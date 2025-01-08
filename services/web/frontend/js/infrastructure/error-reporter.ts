// Conditionally enable Sentry based on whether the DSN token is set
import getMeta from '../utils/meta'
import OError from '@overleaf/o-error'
import { debugConsole } from '@/utils/debugging'

const {
  sentryAllowedOriginRegex,
  sentryDsn,
  sentryEnvironment,
  sentryRelease,
} = getMeta('ol-ExposedSettings')

const reporterPromise = sentryDsn ? sentryReporter() : nullReporter()

function sentryReporter() {
  return (
    import(/* webpackMode: "eager" */ '@sentry/browser')
      .then(Sentry => {
        let eventCount = 0

        Sentry.init({
          dsn: sentryDsn,
          environment: sentryEnvironment,
          release: sentryRelease,
          autoSessionTracking: false,

          // Ignore errors unless they come from our origins
          // Adapted from: https://docs.sentry.io/platforms/javascript/configuration/filtering/#decluttering-sentry
          allowUrls: [new RegExp(sentryAllowedOriginRegex)],

          ignoreErrors: [
            // Ignore very noisy error
            'SecurityError: Permission denied to access property "pathname" on cross-origin object',
            // Ignore unhandled error that is "expected" - see https://github.com/overleaf/issues/issues/3321
            /^Missing PDF/,
            // Ignore "expected" error from aborted fetch - see https://github.com/overleaf/issues/issues/3321
            /^AbortError/,
            // Ignore spurious error from Ace internals - see https://github.com/overleaf/issues/issues/3321
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications.',
            // Microsoft Outlook SafeLink crawler
            // https://forum.sentry.io/t/unhandledrejection-non-error-promise-rejection-captured-with-value/14062
            /Non-Error promise rejection captured with value: Object Not Found Matching Id/,
            // Ignore CM6 error until upgraded
            "Cannot read properties of undefined (reading 'length')",
            // Ignore Angular digest iteration limit - see https://github.com/overleaf/internal/issues/15750
            '10 $digest() iterations reached',
            // Ignore a frequent unhandled promise rejection
            /Non-Error promise rejection captured with keys: currentTarget, detail, isTrusted, target/,
            /Non-Error promise rejection captured with keys: message, status/,
          ],

          denyUrls: [
            // Chrome extensions
            /extensions\//i,
            /^chrome:\/\//i,
          ],

          beforeSend(event) {
            // Limit number of events sent to Sentry to 100 events "per page load",
            // (i.e. the cap will be reset if the page is reloaded). This prevent
            // hitting their server-side event cap.
            eventCount++
            if (eventCount > 100) {
              return null // Block the event from sending
            }

            // Do not send events related to third party code (extensions)
            if (
              (event.extra?.arguments as { type: string }[] | undefined)?.[0]
                ?.type === 'UNSTABLE_editor:extensions'
            ) {
              return null // Block the event from sending
            }

            return event
          },
        })

        Sentry.setUser({ id: getMeta('ol-user_id') })

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
        debugConsole.error(error)
        return nullReporter()
      })
  )
}

function nullReporter() {
  return Promise.resolve({
    captureException: debugConsole.error,
    captureMessage: debugConsole.error,
  })
}

// https://develop.sentry.dev/sdk/data-model/event-payloads/contexts/
// https://docs.sentry.io/platforms/javascript/enriching-events/context/#passing-context-directly
type Options = {
  tags?: Record<string, any>
  extra?: Record<string, any>
}

export function captureException(err: Error, options?: Options) {
  options = options || {}
  const extra = Object.assign(OError.getFullInfo(err), options.extra || {})
  const fullStack = OError.getFullStack(err)
  if (err.stack !== fullStack) {
    // Attach tracebacks from OError.tag() and OError.cause.
    extra.fullStack = fullStack
  }
  reporterPromise.then(reporter =>
    reporter.captureException(err, {
      ...options,
      extra,
    })
  )
}
