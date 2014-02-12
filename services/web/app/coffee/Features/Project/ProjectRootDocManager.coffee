slReqIdHelper = require('soa-req-id')
ProjectEntityHandler = require "./ProjectEntityHandler"
Path = require "path"

module.exports = ProjectRootDocManager =
	setRootDocAutomatically: (project_id, sl_req_id, callback = (error) ->) ->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		ProjectEntityHandler.getAllDocs project_id, sl_req_id, (error, docs) ->
			return callback(error) if error?
			root_doc_id = null
			for path, doc of docs
				for line in doc.lines || []
					if Path.extname(path).match(/\.R?tex$/) and line.match(/\\documentclass/)
						root_doc_id = doc._id
			if root_doc_id?
				ProjectEntityHandler.setRootDoc project_id, root_doc_id, sl_req_id, callback
			else
				callback()

