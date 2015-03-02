Path = require("path")
fs = require("fs")
Settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
url = require "url"

module.exports = ForbidSymlinks = (staticFn, root, options) ->
	expressStatic = staticFn root, options
	basePath = Path.resolve(root)
	return (req, res, next) ->
		path = url.parse(req.url)?.pathname
		requestedFsPath = Path.normalize("#{basePath}/#{path}")
		fs.realpath requestedFsPath, (err, realFsPath)->
			if err?
				logger.warn err:err, requestedFsPath:requestedFsPath, realFsPath:realFsPath, path: req.params[0], project_id: req.params.project_id, "error checking file access"
				if err.code == 'ENOENT'
					return res.sendStatus(404)
				else
					return res.sendStatus(500)
			else if requestedFsPath != realFsPath
				logger.warn requestedFsPath:requestedFsPath, realFsPath:realFsPath, path: req.params[0], project_id: req.params.project_id, "trying to access a different file (symlink), aborting"
				return res.sendStatus(404)
			else
				expressStatic(req, res, next)
