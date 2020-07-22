const logger = require('logger-sharelatex')

function renderJSONError(res, message, info) {
  const fullInfo = { ...info, message }
  if (info.message) {
    logger.warn(
      info,
      `http error info shouldn't contain a 'message' field, will be overridden`
    )
  }
  res.json(fullInfo)
}

module.exports = {
  badRequest(req, res, message, info) {
    res.status(400)
    switch (req.accepts(['html', 'json'])) {
      case 'html':
        return res.render('general/400', {
          title: 'Client Error',
          message: message
        })
      case 'json':
        return renderJSONError(res, message, info || {})
      default:
        return res.send('client error')
    }
  },

  conflict(req, res, message, info) {
    res.status(409)
    switch (req.accepts(['html', 'json'])) {
      case 'html':
        return res.render('general/400', {
          title: 'Client Error',
          message: message
        })
      case 'json':
        return renderJSONError(res, message, info || {})
      default:
        return res.send('conflict')
    }
  },

  forbidden(req, res, message = 'restricted', info = {}) {
    res.status(403)
    switch (req.accepts(['html', 'json'])) {
      case 'html':
        return res.render('user/restricted', { title: 'restricted' })
      case 'json':
        return renderJSONError(res, message, info)
      default:
        return res.send('restricted')
    }
  },

  notFound(req, res, message = 'not found', info = {}) {
    res.status(404)
    switch (req.accepts(['html', 'json'])) {
      case 'html':
        return res.render('general/404', { title: 'page_not_found' })
      case 'json':
        return renderJSONError(res, message, info)
      default:
        return res.send('not found')
    }
  },

  unprocessableEntity(req, res, message = 'unprocessable entity', info = {}) {
    res.status(422)
    switch (req.accepts(['html', 'json'])) {
      case 'html':
        return res.render('general/400', {
          title: 'Client Error',
          message: message
        })
      case 'json':
        return renderJSONError(res, message, info)
      default:
        return res.send('unprocessable entity')
    }
  },

  legacyInternal(req, res, message, error) {
    logger.error(error)
    res.status(500)
    switch (req.accepts(['html', 'json'])) {
      case 'html':
        return res.render('general/500', { title: 'Server Error' })
      case 'json':
        return renderJSONError(res, message, {})
      default:
        return res.send('internal server error')
    }
  }
}
