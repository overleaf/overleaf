ProjectEntityHandler = require "../Project/ProjectEntityHandler"
DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')


module.exports = MetaHandler =

	labelCaptureRegex: () ->
		/\\label\{([^\}\n\\]{0,80})\}/g

	packageCaptureRegex: () ->
		/^\\usepackage(?:\[((?:.|\n)*?)])?\s*?{((?:.|\n)*?)}/gm

	getAllMetaForProject: (projectId, callback=(err, projectMeta)->) ->
		DocumentUpdaterHandler.flushProjectToMongo projectId, (err) ->
			if err?
				return callback err
			ProjectEntityHandler.getAllDocs projectId, (err, docs) ->
				if err?
					return callback err
				projectMeta = MetaHandler.extractMetaFromProjectDocs docs
				callback null, projectMeta

	getMetaForDoc: (projectId, docId, callback=(err, docMeta)->) ->
		DocumentUpdaterHandler.flushDocToMongo projectId, docId, (err) ->
			if err?
				return callback err
			ProjectEntityHandler.getDoc projectId, docId, (err, lines) ->
				if err?
					return callback err
				docMeta = MetaHandler.extractMetaFromDoc lines
				callback null, docMeta

	extractMetaFromDoc: (lines) ->
		docMeta = {labels: [], packages: []}
		label_re = MetaHandler.labelCaptureRegex()
		package_re = MetaHandler.packageCaptureRegex()
		for line in lines
			while labelMatch = label_re.exec line
				if labelMatch[1]
					docMeta.labels.push labelMatch[1]
			while packageMatch = package_re.exec line
				if packageMatch[2]
					for pkg in packageMatch[2].split ','
						if pkg.trim()
							docMeta.packages.push pkg.trim()
		return docMeta

	extractMetaFromProjectDocs: (projectDocs) ->
		projectMeta = {}
		for _path, doc of projectDocs
			projectMeta[doc._id] = MetaHandler.extractMetaFromDoc doc.lines
		return projectMeta
