ProjectEntityHandler = require "../Project/ProjectEntityHandler"


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
		ProjectEntityHandler.getDoc projectId, docId, (err, lines, rev) ->
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

	extractLabelsFromProjectDocs: (docs, callback=(err, projectLabels)->) ->
		projectLabels = {}  # docId => List[Label]
		for _docPath, doc of docs
			docLabels = []
			for line in doc.lines
				re = LabelsHandler.labelCaptureRegex()
				while (labelMatch = re.exec(line))
					if labelMatch[1]
						docLabels.push(labelMatch[1])
			projectLabels[doc._id] = docLabels
		callback(null, projectLabels)
