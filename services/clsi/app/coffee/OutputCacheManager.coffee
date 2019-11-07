async = require "async"
fs = require "fs"
fse = require "fs-extra"
Path = require "path"
logger = require "logger-sharelatex"
_ = require "underscore"
Settings = require "settings-sharelatex"
crypto = require "crypto"

OutputFileOptimiser = require "./OutputFileOptimiser"

module.exports = OutputCacheManager =
	CACHE_SUBDIR: '.cache/clsi'
	ARCHIVE_SUBDIR: '.archive/clsi'
	# build id is HEXDATE-HEXRANDOM from Date.now()and RandomBytes
	# for backwards compatibility, make the randombytes part optional
	BUILD_REGEX: /^[0-9a-f]+(-[0-9a-f]+)?$/
	CACHE_LIMIT: 2  # maximum number of cache directories
	CACHE_AGE: 60*60*1000 # up to one hour old

	path: (buildId, file) ->
		# used by static server, given build id return '.cache/clsi/buildId'
		if buildId.match OutputCacheManager.BUILD_REGEX
			return Path.join(OutputCacheManager.CACHE_SUBDIR, buildId, file)
		else
			# for invalid build id, return top level
			return file

	generateBuildId: (callback = (error, buildId) ->) ->
		# generate a secure build id from Date.now() and 8 random bytes in hex
		crypto.randomBytes 8, (err, buf) ->
			return callback(err) if err?
			random = buf.toString('hex')
			date = Date.now().toString(16)
			callback err, "#{date}-#{random}"

	saveOutputFiles: (outputFiles, compileDir, callback = (error) ->) ->
		OutputCacheManager.generateBuildId (err, buildId) ->
			return callback(err) if err?
			OutputCacheManager.saveOutputFilesInBuildDir outputFiles, compileDir, buildId, callback

	saveOutputFilesInBuildDir: (outputFiles, compileDir, buildId, callback = (error) ->) ->
		# make a compileDir/CACHE_SUBDIR/build_id directory and
		# copy all the output files into it
		cacheRoot = Path.join(compileDir, OutputCacheManager.CACHE_SUBDIR)
		# Put the files into a new cache subdirectory
		cacheDir = Path.join(compileDir, OutputCacheManager.CACHE_SUBDIR, buildId)
		# Is it a per-user compile? check if compile directory is PROJECTID-USERID
		perUser = Path.basename(compileDir).match(/^[0-9a-f]{24}-[0-9a-f]{24}$/)

		# Archive logs in background
		if Settings.clsi?.archive_logs or Settings.clsi?.strace
			OutputCacheManager.archiveLogs outputFiles, compileDir, buildId, (err) ->
				if err?
					logger.warn err:err, "erroring archiving log files"

		# make the new cache directory
		fse.ensureDir cacheDir, (err) ->
			if err?
				logger.error err: err, directory: cacheDir, "error creating cache directory"
				callback(err, outputFiles)
			else
				# copy all the output files into the new cache directory
				results = []
				async.mapSeries outputFiles, (file, cb) ->
					# don't send dot files as output, express doesn't serve them
					if OutputCacheManager._fileIsHidden(file.path)
						logger.debug compileDir: compileDir, path: file.path, "ignoring dotfile in output"
						return cb()
					# copy other files into cache directory if valid
					newFile = _.clone(file)
					[src, dst] = [Path.join(compileDir, file.path), Path.join(cacheDir, file.path)]
					OutputCacheManager._checkFileIsSafe src, (err, isSafe) ->
						return cb(err) if err?
						if !isSafe
							return cb()
						OutputCacheManager._checkIfShouldCopy src, (err, shouldCopy) ->
							return cb(err) if err?
							if !shouldCopy
								return cb()
							OutputCacheManager._copyFile src, dst, (err) ->
								return cb(err) if err?
								newFile.build = buildId  # attach a build id if we cached the file
								results.push newFile
								cb()
				, (err) ->
					if err?
						# pass back the original files if we encountered *any* error
						callback(err, outputFiles)
						# clean up the directory we just created
						fse.remove cacheDir, (err) ->
							if err?
								logger.error err: err, dir: cacheDir, "error removing cache dir after failure"
					else
						# pass back the list of new files in the cache
						callback(err, results)
						# let file expiry run in the background, expire all previous files if per-user
						OutputCacheManager.expireOutputFiles cacheRoot, {keep: buildId, limit: if perUser then 1 else null}

	archiveLogs: (outputFiles, compileDir, buildId, callback = (error) ->) ->
		archiveDir = Path.join(compileDir, OutputCacheManager.ARCHIVE_SUBDIR, buildId)
		logger.log {dir: archiveDir}, "archiving log files for project"
		fse.ensureDir archiveDir, (err) ->
			return callback(err) if err?
			async.mapSeries outputFiles, (file, cb) ->
				[src, dst] = [Path.join(compileDir, file.path), Path.join(archiveDir, file.path)]
				OutputCacheManager._checkFileIsSafe src, (err, isSafe) ->
					return cb(err) if err?
					return cb() if !isSafe
					OutputCacheManager._checkIfShouldArchive src, (err, shouldArchive) ->
						return cb(err) if err?
						return cb() if !shouldArchive
						OutputCacheManager._copyFile src, dst, cb
			, callback

	expireOutputFiles: (cacheRoot, options, callback = (error) ->) ->
		# look in compileDir for build dirs and delete if > N or age of mod time > T
		fs.readdir cacheRoot, (err, results) ->
			if err?
				return callback(null) if err.code == 'ENOENT'	# cache directory is empty
				logger.error err: err, project_id: cacheRoot, "error clearing cache"
				return callback(err)

			dirs =  results.sort().reverse()
			currentTime = Date.now()

			isExpired = (dir, index) ->
				return false if options?.keep == dir
				# remove any directories over the requested (non-null) limit
				return true if options?.limit? and index > options.limit
				# remove any directories over the hard limit
				return true if index > OutputCacheManager.CACHE_LIMIT
				# we can get the build time from the first part of the directory name DDDD-RRRR
				# DDDD is date and RRRR is random bytes
				dirTime = parseInt(dir.split('-')?[0], 16)
				age = currentTime - dirTime
				return age > OutputCacheManager.CACHE_AGE

			toRemove = _.filter(dirs, isExpired)

			removeDir = (dir, cb) ->
				fse.remove Path.join(cacheRoot, dir), (err, result) ->
					logger.log cache: cacheRoot, dir: dir, "removed expired cache dir"
					if err?
						logger.error err: err, dir: dir, "cache remove error"
					cb(err, result)

			async.eachSeries toRemove, (dir, cb) ->
				removeDir dir, cb
			, callback

	_fileIsHidden: (path) ->
		return path?.match(/^\.|\/\./)?

	_checkFileIsSafe: (src, callback = (error, isSafe) ->) ->
		# check if we have a valid file to copy into the cache
		fs.stat src, (err, stats) ->
			if err?.code is 'ENOENT'
				logger.warn err: err, file: src, "file has disappeared before copying to build cache"
				callback(err, false)
			else if err?
				# some other problem reading the file
				logger.error err: err, file: src, "stat error for file in cache"
				callback(err, false)
			else if not stats.isFile()
				# other filetype - reject it
				logger.warn src: src, stat: stats, "nonfile output - refusing to copy to cache"
				callback(null, false)
			else
				# it's a plain file, ok to copy
				callback(null, true)

	_copyFile: (src, dst, callback) ->
		# copy output file into the cache
		fse.copy src, dst, (err) ->
			if err?.code is 'ENOENT'
				logger.warn err: err, file: src, "file has disappeared when copying to build cache"
				callback(err, false)
			else if err?
				logger.error err: err, src: src, dst: dst, "copy error for file in cache"
				callback(err)
			else
				if Settings.clsi?.optimiseInDocker
					# don't run any optimisations on the pdf when they are done
					# in the docker container
					callback()
				else
					# call the optimiser for the file too
					OutputFileOptimiser.optimiseFile src, dst, callback

	_checkIfShouldCopy: (src, callback = (err, shouldCopy) ->) ->
		return callback(null, !Path.basename(src).match(/^strace/))

	_checkIfShouldArchive: (src, callback = (err, shouldCopy) ->) ->
		if Path.basename(src).match(/^strace/)
			return callback(null, true)
		if Settings.clsi?.archive_logs and Path.basename(src) in ["output.log", "output.blg"]
			return callback(null, true)
		return callback(null, false)
