Path = require "path"
fs = require "fs"
logger = require "logger-sharelatex"
settings = require("settings-sharelatex")
SafeReader = require "./SafeReader"

module.exports = ResourceListManager =

	# This file is a list of the input files for the project, one per
	# line, used to identify output files (i.e. files not on this list)
	# when the incoming request is incremental.
	RESOURCE_LIST_FILE: ".project-resource-list"

	saveResourceList: (resources, basePath, callback = (error) ->) ->
		resourceListFile = Path.join(basePath, @RESOURCE_LIST_FILE)
		resourceList = (resource.path for resource in resources)
		fs.writeFile resourceListFile, resourceList.join("\n"), callback

	loadResourceList: (basePath, callback = (error) ->) ->
		resourceListFile = Path.join(basePath, @RESOURCE_LIST_FILE)
		# limit file to 128K, compile directory is user accessible
		SafeReader.readFile resourceListFile, 128*1024, 'utf8', (err, resourceList) ->
			return callback(err) if err?
			resources = ({path: path} for path in resourceList?.toString()?.split("\n") or [])
			callback(null, resources)
