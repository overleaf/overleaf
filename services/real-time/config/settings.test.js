module.exports = {
  errors: {
    catchUncaughtErrors: false,
  },

  security: {
    sessionSecret: 'static-secret-for-tests',
    sessionSecretFallback: 'static-secret-fallback-for-tests',
    sessionSecretUpcoming: 'static-secret-upcoming-for-tests',
  },
}
