const Bowser = require('bowser')
const Settings = require('@overleaf/settings')
const Url = require('url')
const { getSafeRedirectPath } = require('../Features/Helpers/UrlHelper')

function unsupportedBrowserMiddleware(req, res, next) {
  if (!Settings.unsupportedBrowsers) return next()

  // Prevent redirect loop
  const path = req.path
  if (path === '/unsupported-browser') return next()

  const userAgent = req.headers['user-agent']

  if (!userAgent) return next()

  const parser = Bowser.getParser(userAgent)

  // Allow bots through by only ignoring bots or unrecognised UA strings
  const isBot = parser.isPlatform('bot') || !parser.getBrowserName()
  if (isBot) return next()

  const isUnsupported = parser.satisfies(Settings.unsupportedBrowsers)
  if (isUnsupported) {
    return res.redirect(
      Url.format({
        pathname: '/unsupported-browser',
        query: { fromURL: req.originalUrl },
      })
    )
  }

  next()
}

function renderUnsupportedBrowserPage(req, res) {
  let fromURL
  if (typeof req.query.fromURL === 'string') {
    try {
      fromURL =
        Settings.siteUrl + (getSafeRedirectPath(req.query.fromURL) || '/')
    } catch (e) {}
  }
  res.render('general/unsupported-browser', { fromURL })
}

module.exports = {
  renderUnsupportedBrowserPage,
  unsupportedBrowserMiddleware,
}
