const Bowser = require('bowser')
const Settings = require('settings-sharelatex')

function unsupportedBrowserMiddleware(req, res, next) {
  if (!Settings.unsupportedBrowsers) return next()

  const userAgent = req.headers['user-agent']

  const parser = Bowser.getParser(userAgent)

  // Allow bots through by only ignoring bots or unrecognised UA strings
  const isBot = parser.isPlatform('bot') || !parser.getBrowserName()
  if (isBot) return next()

  const isUnsupported = parser.satisfies(Settings.unsupportedBrowsers)
  if (isUnsupported) {
    return res.redirect('/unsupported-browser')
  }

  next()
}

module.exports = { unsupportedBrowserMiddleware }
