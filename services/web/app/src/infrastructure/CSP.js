const crypto = require('crypto')
const path = require('path')

module.exports = function ({
  reportUri,
  reportPercentage,
  reportOnly = false,
  exclude = [],
  percentage
}) {
  return function (req, res, next) {
    const originalRender = res.render

    res.render = (...args) => {
      const view = relativeViewPath(args[0])

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

        // enable the report URI for a percentage of CSP-enabled requests
        const belowReportCutoff = Math.random() * 100 <= reportPercentage

        if (reportUri && belowReportCutoff) {
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

const webRoot = path.resolve(__dirname, '..', '..', '..')

// build the view path relative to the web root
function relativeViewPath(view) {
  return path.isAbsolute(view)
    ? path.relative(webRoot, view)
    : path.join('app', 'views', view)
}
