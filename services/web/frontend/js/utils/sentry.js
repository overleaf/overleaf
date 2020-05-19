// Conditionally enable Sentry based on whether the DSN token is set
// Conditionally enable Sentry based on whether the DSN token is set
if (window.ExposedSettings.sentryDsn) {
  import(/* webpackChunkName: "sentry" */ '@sentry/browser').then(Sentry => {
    let eventCount = 0

    Sentry.init({
      dsn: window.ExposedSettings.sentryDsn,

      // Ignore errors unless they come from overleaf.com/sharelatex.com
      // Adapted from: https://docs.sentry.io/platforms/javascript/#decluttering-sentry
      whitelistUrls: [
        /https:\/\/[a-z]+\.overleaf\.com/,
        /https:\/\/[a-z]+\.sharelatex\.com/
      ],

      ignoreErrors: [
        // Ignore very noisy error
        'SecurityError: Permission denied to access property "pathname" on cross-origin object'
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

    Sentry.configureScope(scope => {
      if (window.user_id.length) {
        scope.setUser(window.user_id)
      }
    })

    // Previously Raven added itself as a global, so we mimic that old behaviour
    window.Raven = Sentry
  })
}
