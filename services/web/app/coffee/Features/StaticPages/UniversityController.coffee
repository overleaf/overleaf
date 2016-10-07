settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
Settings = require("settings-sharelatex")
sixpack = require("../../infrastructure/Sixpack")



module.exports = UniversityController =

	getPage: (req, res, next)->
		url = req.url?.toLowerCase().replace(".html","")
		return res.redirect("/i/#{url}")

	getIndexPage: (req, res)->
		return res.redirect("/i/university")

