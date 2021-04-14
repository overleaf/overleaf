const crypto = require('crypto')

module.exports = function ({
  reportUri,
  reportOnly = false,
  exclude = [],
  percentage
}) {
  return function (req, res, next) {
    const originalRender = res.render

    res.render = (...args) => {
      // use the view path after removing any prefix up to a "views" folder
      const view = args[0].split('/views/').pop()

      // enable the CSP header for a percentage of requests
      const belowCutoff = Math.random() * 100 <= percentage

      if (belowCutoff && !exclude.includes(view)) {
        res.locals.cspEnabled = true

        const scriptNonce = crypto.randomBytes(16).toString('base64')

        res.locals.scriptNonce = scriptNonce

        const directives = [
          `script-src 'nonce-${scriptNonce}' 'unsafe-inline' 'strict-dynamic' https: 'report-sample'`,
          `object-src 'none'`,
          `base-uri 'none'`
        ]

        if (reportUri) {
          directives.push(`report-uri ${reportUri}`)
          // NOTE: implement report-to once it's more widely supported
        }

        const policy = directives.join('; ')

        // Note: https://csp-evaluator.withgoogle.com/ is useful for checking the policy

        const header = reportOnly
          ? 'Content-Security-Policy-Report-Only'
          : 'Content-Security-Policy'

        res.set(header, policy)
      }

      originalRender.apply(res, args)
    }

    next()
  }
}
