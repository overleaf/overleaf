ProjectEntityHandler = require "../Project/ProjectEntityHandler"
DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')


module.exports = LabelsHandler =

	labelCaptureRegex: () ->
		/\\label\{([^\}\n\\]{0,80})\}/g

	getAllLabelsForProject: (projectId, callback=(err, projectLabels)->) ->
		ProjectEntityHandler.getAllDocs projectId, (err, docs) ->
			if err?
				return callback(err)
			projectLabels = LabelsHandler.extractLabelsFromProjectDocs docs
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
				docLabels = LabelsHandler.extractLabelsFromDoc lines
				callback(null, docLabels)

	extractLabelsFromDoc: (lines) ->
		docLabels = []
		for line in lines
			re = LabelsHandler.labelCaptureRegex()
			while (labelMatch = re.exec(line))
				if labelMatch[1]
					docLabels.push(labelMatch[1])
		return docLabels

	extractLabelsFromProjectDocs: (projectDocs) ->
		projectLabels = {}  # docId => List[Label]
		for _path, doc of projectDocs
			projectLabels[doc._id] = LabelsHandler.extractLabelsFromDoc(doc.lines)
		return projectLabels
