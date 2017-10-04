ProjectEntityHandler = require "../Project/ProjectEntityHandler"
DocumentUpdaterHandler = require '../DocumentUpdater/DocumentUpdaterHandler'


module.exports = MetadataHandler =

	labelCaptureRegex: () ->
		/\\label\{([^\}\n\\]{0,80})\}/g

	packageCaptureRegex: () ->
		/\\usepackage(?:\[((?:.|\n)*?)])?\s*?{((?:.|\n)*?)}/gm

	getMetadataForProject: (projectId, callback=(err, projectMetadata)->) ->
		DocumentUpdaterHandler.flushProjectToMongo projectId. (err) ->
			if err?
				return callback(err)
			ProjectEntityHandler.getAllDocs projectId, (err, docs) ->
				if err?
					return callback(err)
				projectMetadata = MetadataHandler.extractMetadataFromProjectDocs docs
				callback(null, projectMetadata)

	getMetadataForDoc: (projectId, docId, callback=(err, docMetadata)->) ->
		DocumentUpdaterHandler.flushDocToMongo projectId, docId, (err) ->
			if err?
				return callback(err)
			ProjectEntityHandler.getDoc projectId, docId, (err, lines) ->
				if err?
					return callback(err)
				docMetadata = MetadataHandler.extractMetadataFromDoc lines
				callback(null, docMetadata)

	extractMetadataFromProjectDocs: (projectDocs) ->
		projectMetadata = {}
		for _path, doc of projectDocs
			projectMetadata[doc._id] = MetadataHandler.extractMetadataFromDoc doc.lines
		return projectMetadata

	extractMetadataFromDoc: (lines) ->
		docMetadata = {labels: [] packages: []}
		label_re = MetadataHandler.labelCaptureRegex()
		package_re = MetadataHandler.packageCaptureRegex()
		for line in lines # FIXME: usepackage can run over multiple lines
			while labelMatch = label_re.exec line
				if labelMatch[1]
					docMetadata.labels.push labelMatch[1]
			while packageMatch = package_re.exec line
				if packageMatch[2]
					docMetadata.packages.push packageMatch[2]
		return docMetadata
