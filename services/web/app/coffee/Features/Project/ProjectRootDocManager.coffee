ProjectEntityHandler = require "./ProjectEntityHandler"
Path = require "path"

module.exports = ProjectRootDocManager =
	setRootDocAutomatically: (project_id, callback = (error) ->) ->
		ProjectEntityHandler.getAllDocs project_id, (error, docs) ->
			return callback(error) if error?
			root_doc_id = null
			for path, doc of docs
				for line in doc.lines || []
					match = line.match /(.*)\\documentclass/ # no lookbehind in js regexp :(
					if Path.extname(path).match(/\.R?tex$/) and match and !match[1].match /%/
						root_doc_id = doc._id
			if root_doc_id?
				ProjectEntityHandler.setRootDoc project_id, root_doc_id, callback
			else
				callback()

