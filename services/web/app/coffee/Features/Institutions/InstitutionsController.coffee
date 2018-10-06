UserGetter = require("../User/UserGetter")

module.exports = InstitutionsController =
	confirmDomain: (req, res, next) ->
		hostname = req.body.hostname
		UserGetter.getUsersByHostname hostname, {_id:1, emails:1}, (error, users) ->
			res.json {hostname: hostname, wub: users}
