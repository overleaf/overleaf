const crypto = require('crypto')
const path = require('path')

module.exports = function ({
  reportUri,
  reportPercentage,
  reportOnly = false,
  exclude = [],
}) {
  const header = reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy'

  const defaultPolicy = buildDefaultPolicy(reportUri)

  return function (req, res, next) {
    // set the default policy
    res.set(header, defaultPolicy)

    const originalRender = res.render

    res.render = (...args) => {
      const view = relativeViewPath(args[0])

      if (exclude.includes(view)) {
        // remove the default policy
        res.removeHeader(header)
      } else {
        // set the view policy
        res.locals.cspEnabled = true

        const scriptNonce = crypto.randomBytes(16).toString('base64')

        res.locals.scriptNonce = scriptNonce

        const policy = buildViewPolicy(scriptNonce, reportPercentage, reportUri)

        // Note: https://csp-evaluator.withgoogle.com/ is useful for checking the policy

        res.set(header, policy)
      }

      originalRender.apply(res, args)
    }

    next()
  }
}

const buildDefaultPolicy = reportUri => {
  const directives = [
    `base-uri 'none'`, // forbid setting a "base" element
    `default-src 'none'`, // forbid loading anything from a "src" attribute
    `form-action 'none'`, // forbid setting a form action
    `frame-ancestors 'none'`, // forbid loading embedded content
    `img-src 'self'`, // allow loading images from the same domain (e.g. the favicon).
  ]

  if (reportUri) {
    directives.push(`report-uri ${reportUri}`)
    // NOTE: implement report-to once it's more widely supported
  }

  return directives.join('; ')
}

const buildViewPolicy = (scriptNonce, reportPercentage, reportUri) => {
  const directives = [
    `script-src 'nonce-${scriptNonce}' 'unsafe-inline' 'strict-dynamic' https: 'report-sample'`, // only allow scripts from certain sources
    `object-src 'none'`, // forbid loading an "object" element
    `base-uri 'none'`, // forbid setting a "base" element
  ]

  if (reportUri) {
    // enable the report URI for a percentage of CSP-enabled requests
    const belowReportCutoff = Math.random() * 100 <= reportPercentage

    if (belowReportCutoff) {
      directives.push(`report-uri ${reportUri}`)
      // NOTE: implement report-to once it's more widely supported
    }
  }

  return directives.join('; ')
}

const webRoot = path.resolve(__dirname, '..', '..', '..')

// build the view path relative to the web root
function relativeViewPath(view) {
  return path.isAbsolute(view)
    ? path.relative(webRoot, view)
    : path.join('app', 'views', view)
}

function removeCSPHeaders(res) {
  res.removeHeader('Content-Security-Policy')
  res.removeHeader('Content-Security-Policy-Report-Only')
}

module.exports.buildDefaultPolicy = buildDefaultPolicy
module.exports.removeCSPHeaders = removeCSPHeaders
