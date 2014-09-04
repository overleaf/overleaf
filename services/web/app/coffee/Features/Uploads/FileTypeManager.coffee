fs = require "fs"
Path = require("path")

module.exports = FileTypeManager =
	TEXT_EXTENSIONS : [
		"tex", "latex", "sty", "cls", "bst", "bib", "bibtex", "txt", "tikz", "rtex", "md"
	]

	IGNORE_EXTENSIONS : [
		"dvi", "aux", "log", "ps", "toc", "out", "pdfsync"
		# Index and glossary files
		"nlo", "ind", "glo", "gls", "glg"
		# Bibtex
		"bbl", "blg"
		# Misc/bad
		"doc", "docx", "gz"
	]

	IGNORE_FILENAMES : [
		"__MACOSX"
	]
	
	MAX_TEXT_FILE_SIZE: 1 * 1024 * 1024 # 1 MB

	isDirectory: (path, callback = (error, result) ->) ->
		fs.stat path, (error, stats) ->
			callback(error, stats.isDirectory())

	isBinary: (name, fsPath, callback = (error, result) ->) ->
		parts = name.split(".")
		extension = parts.slice(-1)[0]
		if extension?
			extension = extension.toLowerCase()
		binaryFile = (@TEXT_EXTENSIONS.indexOf(extension) == -1 or parts.length <= 1)
		
		if binaryFile
			return callback null, true

		fs.stat fsPath, (error, stat) ->
			return callback(error) if error?
			if stat.size > FileTypeManager.MAX_TEXT_FILE_SIZE
				return callback null, true # Treat large text file as binary
			else
				return callback null, false

	shouldIgnore: (path, callback = (error, result) ->) ->
		name = Path.basename(path)
		extension = name.split(".").slice(-1)[0]
		if extension?
			extension = extension.toLowerCase()
		ignore = false
		if name[0] == "."
			ignore = true
		if @IGNORE_EXTENSIONS.indexOf(extension) != -1
			ignore = true
		if @IGNORE_FILENAMES.indexOf(name) != -1
			ignore = true
		callback null, ignore



