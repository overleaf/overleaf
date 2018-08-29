ProjectEntityHandler = require "./ProjectEntityHandler"
ProjectEntityUpdateHandler = require "./ProjectEntityUpdateHandler"
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
					rootDocId = null
					for line in doc.lines || []
						# We've had problems with this regex locking up CPU.
						# Previously /.*\\documentclass/ would totally lock up on lines of 500kb (data text files :()
						# This regex will only look from the start of the line, including whitespace so will return quickly
						# regardless of line length.
						match = /^\s*\\documentclass/.test(line)
						isRootDoc = /\.R?tex$/.test(Path.extname(path)) and match
						if isRootDoc
							rootDocId = doc?._id
					cb(rootDocId)

			async.series jobs, (root_doc_id)->
				if root_doc_id?
					ProjectEntityUpdateHandler.setRootDoc project_id, root_doc_id, callback
				else
					callback()
