const logger = require('logger-sharelatex')

function renderJSONError(res, message, info) {
  const fullInfo = { message, ...info }
  if (info.message) {
    logger.warn(
      info,
      `http error info shouldn't contain a 'message' field, will be overridden`
    )
  }
  res.json(fullInfo)
}

module.exports = {
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
  }
}
