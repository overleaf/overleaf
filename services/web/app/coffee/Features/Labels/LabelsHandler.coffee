ProjectEntityHandler = require "../Project/ProjectEntityHandler"
DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
Async = require('async')


module.exports = LabelsHandler =

	labelCaptureRegex: () ->
		/\\label\{([^\}\n\\]{0,80})\}/g

	getAllLabelsForProject: (projectId, callback=(err, projectLabels)->) ->
		ProjectEntityHandler.getAllDocs projectId, (err, docs) ->
			if err?
				return callback(err)
			LabelsHandler.extractLabelsFromProjectDocs docs, (err, projectLabels) ->
				if err?
					return callback(err)
				callback(null, projectLabels)

	getLabelsForDoc: (projectId, docId, callback=(err, docLabels)->) ->
		# Flush doc first, because this action is often performed while
		# a document is being edited by the client. By contrast,
		# `getAllLabelsForProject` is called only when a project/editor is loaded
		DocumentUpdaterHandler.flushDocToMongo projectId, docId, (err) ->
			if err?
				return callback(err)
			ProjectEntityHandler.getDoc projectId, docId, (err, lines) ->
				if err?
					return callback(err)
				LabelsHandler.extractLabelsFromDoc lines, (err, docLabels) ->
					if err?
						return callback(err)
					callback(null, docLabels)

	extractLabelsFromDoc: (lines, callback=(err, docLabels)->) ->
		docLabels = []
		for line in lines
			re = LabelsHandler.labelCaptureRegex()
			while (labelMatch = re.exec(line))
				if labelMatch[1]
					docLabels.push(labelMatch[1])
		callback(null, docLabels)

	extractLabelsFromProjectDocs: (projectDocs, callback=(err, projectLabels)->) ->
		projectLabels = {}  # docId => List[Label]
		docs = for _path, doc of projectDocs
			doc
		Async.eachSeries(
			docs
			, (doc, cb) ->
				LabelsHandler.extractLabelsFromDoc doc.lines, (err, docLabels) ->
					projectLabels[doc._id] = docLabels
					cb(err)
			, (err, x) ->
				callback(err, projectLabels)
		)
