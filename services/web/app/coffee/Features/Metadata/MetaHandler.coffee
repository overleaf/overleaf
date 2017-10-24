ProjectEntityHandler = require "../Project/ProjectEntityHandler"
DocumentUpdaterHandler = require '../DocumentUpdater/DocumentUpdaterHandler'
packageMapping = require "./packageMapping"


module.exports = MetaHandler =

	labelRegex: () ->
		/\\label{(.{0,80}?)}/g

	usepackageRegex: () ->
		/^\\usepackage(?:\[.{0,80}?])?{(.{0,80}?)}/g

	ReqPackageRegex: () ->
		/^\\RequirePackage(?:\[.{0,80}?])?{(.{0,80}?)}/g

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
		docMeta = {labels: [], packages: {}}
		packages = []
		label_re = MetaHandler.labelRegex()
		package_re = MetaHandler.usepackageRegex()
		req_package_re = MetaHandler.ReqPackageRegex()
		for line in lines
			while labelMatch = label_re.exec line
				if label = labelMatch[1]
					docMeta.labels.push label
			while packageMatch = package_re.exec line
				if messy = packageMatch[1]
					for pkg in messy.split ','
						if clean = pkg.trim()
							packages.push clean
			while packageMatch = req_package_re.exec line
				if messy = packageMatch[1]
					for pkg in messy.split ','
						if clean = pkg.trim()
							packages.push clean
		for pkg in packages
			if packageMapping[pkg]?
				docMeta.packages[pkg] = packageMapping[pkg]
		return docMeta

	extractMetaFromProjectDocs: (projectDocs) ->
		projectMeta = {}
		for _path, doc of projectDocs
			projectMeta[doc._id] = MetaHandler.extractMetaFromDoc doc.lines
		return projectMeta
