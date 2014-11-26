ProjectEntityHandler = require "./ProjectEntityHandler"
Path = require "path"
async = require("async")
_ = require("underscore")

module.exports = ProjectRootDocManager =
	setRootDocAutomatically: (project_id, callback = (error) ->) ->
		ProjectEntityHandler.getAllDocs project_id, (error, docs) ->
			return callback(error) if error?


			root_doc_id = null
			jobs = _.map docs, (doc, path)->
				return (cb)->
					for line in doc.lines || []
						match = line.match /(.*)\\documentclass/ # no lookbehind in js regexp :(
						isRootDoc = Path.extname(path).match(/\.R?tex$/) and match and !match[1].match /%/
						if isRootDoc
							return cb(doc?._id)
						else
							return cb()
			async.series jobs, (root_doc_id)->
				if root_doc_id?
					ProjectEntityHandler.setRootDoc project_id, root_doc_id, callback
				else
					callback()

