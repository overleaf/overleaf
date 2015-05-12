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
		# check that the path is of the form /project_id_or_name/path/to/file.log
		if result = path.match(/^\/?([a-zA-Z0-9_-]+)\/(.*)/)
			project_id = result[1]
			file = result[2]
		else
			logger.warn path: path, "unrecognized file request"
			return res.sendStatus(404)
		# check that the file does not use a relative path
		for dir in file.split('/')
			if dir == '..'
				logger.warn path: path, "attempt to use a relative path"
				return res.sendStatus(404)
		# check that the requested path is normalized
		requestedFsPath = "#{basePath}/#{project_id}/#{file}"
		if requestedFsPath != Path.normalize(requestedFsPath)
				logger.error path: requestedFsPath, "requestedFsPath is not normalized"
				return res.sendStatus(404)
		# check that the requested path is not a symlink
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
