const InstitutionsManager = require('./InstitutionsManager')

module.exports = {
  confirmDomain(req, res, next) {
    const { hostname } = req.body
    InstitutionsManager.confirmDomain(hostname, function (error) {
      if (error) {
        return next(error)
      }
      res.sendStatus(200)
    })
  },
}
