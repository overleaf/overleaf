const logger = require('logger-sharelatex')

module.exports = {
  forbidden(req, res, message = 'restricted', info = {}) {
    res.status(403)
    switch (req.accepts(['html', 'json'])) {
      case 'html':
        return res.render('user/restricted', { title: 'restricted' })
      case 'json':
        const fullInfo = { message, ...info }
        if (info.message) {
          logger.warn(
            info,
            `http error info shouldn't contain a 'message' field, will be overridden`
          )
        }
        return res.json(fullInfo)
      default:
        return res.send('restricted')
    }
  }
}
