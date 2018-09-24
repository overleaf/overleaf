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

	setRootDocFromName: (project_id, rootDocName, callback = (error) ->) ->
		ProjectEntityHandler.getAllDocPathsFromProjectById project_id, (error, docPaths) ->
			return callback(error) if error?
			# find the root doc from the filename
			root_doc_id = null
			for doc_id, path of docPaths
				# docpaths have a leading / so allow matching "folder/filename" and "/folder/filename"
				if path == rootDocName or path == "/#{rootDocName}"
					root_doc_id = doc_id
			# try a basename match if there was no match 
			if !root_doc_id
				for doc_id, path of docPaths
					if Path.basename(path) == Path.basename(rootDocName) 
						root_doc_id = doc_id
			# set the root doc id if we found a match
			if root_doc_id?
				ProjectEntityUpdateHandler.setRootDoc project_id, root_doc_id, callback
			else
				callback()