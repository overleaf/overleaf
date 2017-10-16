child   = require "child_process"
logger  = require "logger-sharelatex"
metrics = require "metrics-sharelatex"
fs      = require "fs"
Path    = require "path"
fse     = require "fs-extra"
yauzl   = require "yauzl"
Settings = require "settings-sharelatex"
_ = require("underscore")

ONE_MEG = 1024 * 1024

module.exports = ArchiveManager =

	_isZipTooLarge: (source, callback = (err, isTooLarge)->)->
		callback = _.once callback

		totalSizeInBytes = null
		yauzl.open source, {lazyEntries: true}, (err, zipfile) ->
			return callback(err) if err?

			if Settings.maxEntitiesPerProject? and zipfile.entryCount > Settings.maxEntitiesPerProject
				return callback(null, true) # too many files in zip file

			zipfile.on "error", callback

			# read all the entries
			zipfile.readEntry()
			zipfile.on "entry", (entry) ->
				totalSizeInBytes += entry.uncompressedSize
				zipfile.readEntry() # get the next entry

			# no more entries to read
			zipfile.on "end", () ->
				if !totalSizeInBytes? or isNaN(totalSizeInBytes)
					logger.err source:source, totalSizeInBytes:totalSizeInBytes, "error getting bytes of zip"
					return callback(new Error("error getting bytes of zip"))
				isTooLarge = totalSizeInBytes > (ONE_MEG * 300)
				callback(null, isTooLarge)

	_checkFilePath: (entry, destination, callback = (err, destFile) ->) ->
		# check if the entry is a directory
		if /\/$/.test(entry.fileName)
			return callback() # don't give a destfile for directory
		# check that the file does not use a relative path
		for dir in entry.fileName.split('/')
			if dir == '..'
				return callback(new Error("relative path"))
		# check that the destination file path is normalized
		dest = "#{destination}/#{entry.fileName}"
		if dest != Path.normalize(dest)
			return callback(new Error("unnormalized path"))
		else
			return callback(null, dest)

	_writeFileEntry: (zipfile, entry, destFile, callback = (err)->) ->
		callback = _.once callback

		zipfile.openReadStream entry, (err, readStream) ->
			return callback(err) if err?
			readStream.on "error", callback
			readStream.on "end", callback

			errorHandler = (err) -> # clean up before calling callback
				readStream.unpipe()
				readStream.destroy()
				callback(err)

			fse.ensureDir Path.dirname(destFile), (err) ->
				return errorHandler(err) if err?
				writeStream = fs.createWriteStream destFile
				writeStream.on 'error', errorHandler
				readStream.pipe(writeStream)

	_extractZipFiles: (source, destination, callback = (err) ->) ->
		callback = _.once callback

		yauzl.open source, {lazyEntries: true}, (err, zipfile) ->
			return callback(err) if err?
			zipfile.on "error", callback
			# read all the entries
			zipfile.readEntry()
			zipfile.on "entry", (entry) ->
				ArchiveManager._checkFilePath entry, destination, (err, destFile) ->
					if err?
						logger.warn err:err, source:source, destination:destination, "skipping bad file path"
						zipfile.readEntry() # bad path, just skip to the next file
						return
					if destFile? # only write files
						ArchiveManager._writeFileEntry zipfile, entry, destFile, (err) ->
							if err?
								logger.error err:err, source:source, destFile:destFile, "error unzipping file entry"
								zipfile.close() # bail out, stop reading file entries
								return callback(err)
							else
								zipfile.readEntry() # continue to the next file
			# no more entries to read
			zipfile.on "end", callback

	extractZipArchive: (source, destination, _callback = (err) ->) ->
		callback = (args...) ->
			_callback(args...)
			_callback = () ->

		ArchiveManager._isZipTooLarge source, (err, isTooLarge)->
			if err?
				logger.err err:err, "error checking size of zip file"
				return callback(err)

			if isTooLarge
				return callback(new Error("zip_too_large"))

			timer = new metrics.Timer("unzipDirectory")
			logger.log source: source, destination: destination, "unzipping file"

			ArchiveManager._extractZipFiles source, destination, (err) ->
				timer.done()
				if err?
					logger.error {err, source, destination}, "unzip failed"
					callback(err)
				else
					callback()

	findTopLevelDirectory: (directory, callback = (error, topLevelDir) ->) ->
		fs.readdir directory, (error, files) ->
			return callback(error) if error?
			if files.length == 1
				childPath = Path.join(directory, files[0])
				fs.stat childPath, (error, stat) ->
					return callback(error) if error?
					if stat.isDirectory()
						return callback(null, childPath)
					else
						return callback(null, directory)
			else
				return callback(null, directory)

