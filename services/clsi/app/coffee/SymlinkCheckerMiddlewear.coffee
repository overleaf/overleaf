Path = require("path")
fs = require("fs")
Settings = require("settings-sharelatex")
logger = require("logger-sharelatex")


module.exports = (req, res, next)->
	basePath = Path.resolve("#{Settings.path.compilesDir}/#{req.params.project_id}")
	requestedFsPath = Path.normalize("#{basePath}/#{req.params[0]}")
	fs.realpath requestedFsPath, (err, realFsPath)->
		if err?
			return res.send(500)
		else if requestedFsPath != realFsPath
			logger.warn requestedFsPath:requestedFsPath, realFsPath:realFsPath, path: req.params[0], project_id: req.params.project_id, "trying to access a different file (symlink), aborting"
			return res.send(404)
		else
			return next()
