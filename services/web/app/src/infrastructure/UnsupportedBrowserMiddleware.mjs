import Bowser from 'bowser'
import Settings from '@overleaf/settings'
import Url from 'node:url'
import UrlHelper from '../Features/Helpers/UrlHelper.mjs'
import { z, parseReq } from './Validation.mjs'

const { getSafeRedirectPath } = UrlHelper

// middleware schema is non-strict: it validates only the header this
// middleware consumes, applied globally to every route
const unsupportedBrowserMiddlewareSchema = z.object({
  headers: z.object({
    'user-agent': z.string().optional(),
  }),
})

const renderUnsupportedBrowserPageSchema = z.object({
  query: z.object({
    fromURL: z.string().optional(),
  }),
})

function unsupportedBrowserMiddleware(req, res, next) {
  if (!Settings.unsupportedBrowsers) return next()

  // Prevent redirect loop
  const path = req.path
  if (path === '/unsupported-browser') return next()

  const { headers } = parseReq(req, unsupportedBrowserMiddlewareSchema, {
    logOnly: true,
  })
  const userAgent = headers['user-agent']

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
  const { query } = parseReq(req, renderUnsupportedBrowserPageSchema, {
    logOnly: true,
  })
  let fromURL
  if (typeof query.fromURL === 'string') {
    try {
      fromURL = Settings.siteUrl + (getSafeRedirectPath(query.fromURL) || '/')
    } catch (e) {}
  }
  res.render('general/unsupported-browser', { fromURL })
}

export default {
  renderUnsupportedBrowserPage,
  unsupportedBrowserMiddleware,
}
