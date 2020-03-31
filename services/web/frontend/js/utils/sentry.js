// Conditionally enable Sentry based on whether the DSN token is set
if (window.ExposedSettings.sentryDsn) {
  import(/* webpackChunkName: "sentry" */ '@sentry/browser').then(Sentry => {
    Sentry.init({
      dsn: window.ExposedSettings.sentryDsn,

      // Ignore errors unless they come from overleaf.com/sharelatex.com
      // Adapted from: https://docs.sentry.io/platforms/javascript/#decluttering-sentry
      whitelistUrls: [
        /https:\/\/[a-z]+\.overleaf\.com/,
        /https:\/\/[a-z]+\.sharelatex\.com/
      ]
    })

    // Previously Raven added itself as a global, so we mimic that old behaviour
    window.Raven = Sentry
  })
}
