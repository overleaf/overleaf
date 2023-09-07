const { affiliateUsers } = require('./InstitutionsManager')

module.exports = {
  confirmDomain(req, res, next) {
    const { hostname } = req.body
    affiliateUsers(hostname, function (error) {
      if (error) {
        return next(error)
      }
      res.sendStatus(200)
    })
  },
}
