ProjectEntityHandler = require "./ProjectEntityHandler"
ProjectEntityUpdateHandler = require "./ProjectEntityUpdateHandler"
ProjectGetter = require "./ProjectGetter"
DocumentHelper = require "../Documents/DocumentHelper"
Path = require "path"
fs = require("fs")
async = require("async")
globby = require("globby")
_ = require("underscore")

module.exports = ProjectRootDocManager =
	setRootDocAutomatically: (project_id, callback = (error) ->) ->
		ProjectEntityHandler.getAllDocs project_id, (error, docs) ->
			return callback(error) if error?

			jobs = _.map docs, (doc, path)->
				return (cb)->
					if /\.R?tex$/.test(Path.extname(path)) && DocumentHelper.contentHasDocumentclass(doc.lines)
						cb(doc._id)
					else
						cb(null)

			async.series jobs, (root_doc_id)->
				if root_doc_id?
					ProjectEntityUpdateHandler.setRootDoc project_id, root_doc_id, callback
				else
					callback()

	findRootDocFileFromDirectory: (directoryPath, callback = (error, path, content) ->) ->
		filePathsPromise = globby([
				'**/*.{tex,Rtex}'
			], {
				cwd: directoryPath,
				followSymlinkedDirectories: false,
				onlyFiles: true,
				case: false
			}
		)

		# the search order is such that we prefer files closer to the project root, then
		# we go by file size in ascending order, because people often have a main
		# file that just includes a bunch of other files; then we go by name, in
		# order to be deterministic
		filePathsPromise.then(
			(unsortedFiles) ->
				ProjectRootDocManager._sortFileList unsortedFiles, directoryPath, (err, files) ->
					return callback(err) if err?
					doc = null

					async.until(
						->
							return doc? || files.length == 0
						(cb) ->
							file = files.shift()
							fs.readFile Path.join(directoryPath, file), 'utf8', (error, content) ->
								return cb(error) if error?
								content = (content || '').replace(/\r/g, '')
								if DocumentHelper.contentHasDocumentclass(content)
									doc = {path: file, content: content}
								cb(null)
						(err) ->
							callback(err, doc?.path, doc?.content)
					)
			(err) ->
				callback(err)
		)

		# coffeescript's implicit-return mechanism returns filePathsPromise from this method, which confuses mocha
		return null

	setRootDocFromName: (project_id, rootDocName, callback = (error) ->) ->
		ProjectEntityHandler.getAllDocPathsFromProjectById project_id, (error, docPaths) ->
			return callback(error) if error?
			# strip off leading and trailing quotes from rootDocName
			rootDocName = rootDocName.replace(/^\'|\'$/g,"")
			# prepend a slash for the root folder if not present
			rootDocName = "/#{rootDocName}" if rootDocName[0] isnt '/'
			# find the root doc from the filename
			root_doc_id = null
			for doc_id, path of docPaths
				# docpaths have a leading / so allow matching "folder/filename" and "/folder/filename"
				if path == rootDocName
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

	ensureRootDocumentIsSet: (project_id, callback = (error) ->) ->
		ProjectGetter.getProject project_id, rootDoc_id: 1, (error, project) ->
			return callback(error) if error?
			if !project?
				return callback new Error("project not found")

			if project.rootDoc_id?
				callback()
			else
				ProjectRootDocManager.setRootDocAutomatically project_id, callback

	ensureRootDocumentIsValid: (project_id, callback = (error) ->) ->
		ProjectGetter.getProject project_id, rootDoc_id: 1, (error, project) ->
			return callback(error) if error?
			if !project?
				return callback new Error("project not found")

			if project.rootDoc_id?
				ProjectEntityHandler.getAllDocPathsFromProjectById project_id, (error, docPaths) ->
					return callback(error) if error?
					rootDocValid = false
					for doc_id, _path of docPaths
						if doc_id == project.rootDoc_id
							rootDocValid = true
					if rootDocValid
						callback()
					else
						ProjectEntityUpdateHandler.setRootDoc project_id, null, ->
							ProjectRootDocManager.setRootDocAutomatically project_id, callback
			else
				ProjectRootDocManager.setRootDocAutomatically project_id, callback

	_sortFileList: (listToSort, rootDirectory, callback = (error, result)->) ->
		async.mapLimit(
			listToSort
			5
			(filePath, cb) ->
				fs.stat Path.join(rootDirectory, filePath), (err, stat) ->
					return cb(err) if err?
					cb(null,
						size: stat.size
						path: filePath
						elements: filePath.split(Path.sep).length
						name: Path.basename(filePath)
					)
			(err, files) ->
				return callback(err) if err?

				callback(null, _.map files.sort(ProjectRootDocManager._rootDocSort), (file)-> return file.path)
		)

	_rootDocSort: (a, b) ->
		# sort first by folder depth
		return a.elements - b.elements if a.elements != b.elements
		# ensure main.tex is at the start of each folder
		return -1 if (a.name == 'main.tex' && b.name != 'main.tex')
		return 1 if (a.name != 'main.tex' && b.name == 'main.tex')
		# prefer smaller files
		return a.size - b.size if a.size != b.size
		# otherwise, use the full path name
		return a.path.localeCompare(b.path)
