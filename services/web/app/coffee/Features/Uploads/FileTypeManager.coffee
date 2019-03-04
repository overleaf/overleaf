fs = require "fs"
Path = require("path")
isUtf8 = require('is-utf8');


module.exports = FileTypeManager =
	TEXT_EXTENSIONS : [
		"tex", "latex", "sty", "cls", "bst", "bib", "bibtex", "txt", "tikz", "rtex", "md", "asy", "latexmkrc", "lbx", "bbx", "cbx", "m"
	]

	IGNORE_EXTENSIONS : [
		"dvi", "aux", "log", "toc", "out", "pdfsync"
		# Index and glossary files
		"nlo", "ind", "glo", "gls", "glg"
		# Bibtex
		"bbl", "blg"
		# Misc/bad
		"doc", "docx", "gz"
	]

	IGNORE_FILENAMES : [
		"__MACOSX"
		".git"
		".gitignore"
	]
	
	MAX_TEXT_FILE_SIZE: 1 * 1024 * 1024 # 1 MB

	isDirectory: (path, callback = (error, result) ->) ->
		fs.stat path, (error, stats) ->
			return callback(error) if error?
			callback(null, stats?.isDirectory())

	# returns charset as understood by fs.readFile,
	getType: (name, fsPath, callback = (error, isBinary, charset) ->) ->
		parts = name.split(".")
		extension = parts.slice(-1)[0].toLowerCase()
		isText = (FileTypeManager.TEXT_EXTENSIONS.indexOf(extension) > -1 and parts.length > 1) or parts[0] == 'latexmkrc'

		return callback null, true unless isText

		fs.stat fsPath, (error, stat) ->
			return callback(error) if error?
			if stat.size > FileTypeManager.MAX_TEXT_FILE_SIZE
				return callback null, true # Treat large text file as binary

			fs.readFile fsPath, (err, bytes) ->
				return callback(err) if err?

				if isUtf8(bytes)
					return callback null, false, "utf-8"
				# check for little-endian unicode bom (nodejs does not support big-endian)
				if bytes[0] == 0xFF and bytes[1] == 0xFE
					return callback null, false, "utf-16le"

				callback null, false, "latin1"

	shouldIgnore: (path, callback = (error, result) ->) ->
		name = Path.basename(path)
		extension = name.split(".").slice(-1)[0]
		if extension?
			extension = extension.toLowerCase()
		ignore = false
		if name[0] == "." and extension != 'latexmkrc'
			ignore = true
		if @IGNORE_EXTENSIONS.indexOf(extension) != -1
			ignore = true
		if @IGNORE_FILENAMES.indexOf(name) != -1
			ignore = true
		callback null, ignore
