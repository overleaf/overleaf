module.exports =
	docs: (docs) ->
		docs.map (doc) ->
			{
				path: doc.path
				id: doc.doc
			}

	files: (files) ->
		files.map (file) ->
			{
				path: file.path
				id: file.file
			}
