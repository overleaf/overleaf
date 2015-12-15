async = require "async"
fs = require "fs"
fse = require "fs-extra"
Path = require "path"
logger = require "logger-sharelatex"
_ = require "underscore"

OutputFileOptimiser = require "./OutputFileOptimiser"

module.exports = OutputCacheManager =
	CACHE_SUBDIR: '.cache/clsi'
	BUILD_REGEX: /^[0-9a-f]+$/  # build id is Date.now() converted to hex
	CACHE_LIMIT: 2  # maximum number of cache directories
	CACHE_AGE: 60*60*1000 # up to one hour old

	path: (buildId, file) ->
		# used by static server, given build id return '.cache/clsi/buildId'
		if buildId.match OutputCacheManager.BUILD_REGEX
			return Path.join(OutputCacheManager.CACHE_SUBDIR, buildId, file)
		else
			# for invalid build id, return top level
			return file

	saveOutputFiles: (outputFiles, compileDir, callback = (error) ->) ->
		# make a compileDir/CACHE_SUBDIR/build_id directory and
		# copy all the output files into it
		cacheRoot = Path.join(compileDir, OutputCacheManager.CACHE_SUBDIR)
		# Put the files into a new cache subdirectory
		buildId = Date.now().toString(16)
		cacheDir = Path.join(compileDir, OutputCacheManager.CACHE_SUBDIR, buildId)
		# let file expiry run in the background
		OutputCacheManager.expireOutputFiles cacheRoot, {keep: buildId}

		checkFile = (src, callback) ->
			# check if we have a valid file to copy into the cache
			fs.stat src, (err, stats) ->
				if err?
					# some problem reading the file
					logger.error err: err, file: src, "stat error for file in cache"
					callback(err)
				else if not stats.isFile()
					# other filetype - reject it
					logger.error err: err, src: src, stat: stats, "nonfile output - refusing to copy to cache"
					callback(new Error("output file is not a file"), file)
				else
					# it's a plain file, ok to copy
					callback(null)

		copyFile = (src, dst, callback) ->
			# copy output file into the cache
			fse.copy src, dst, (err) ->
				if err?
					logger.error err: err, src: src, dst: dst, "copy error for file in cache"
					callback(err)
				else
					# call the optimiser for the file too
					OutputFileOptimiser.optimiseFile src, dst, callback

		# make the new cache directory
		fse.ensureDir cacheDir, (err) ->
			if err?
				logger.error err: err, directory: cacheDir, "error creating cache directory"
				callback(err, outputFiles)
			else
				# copy all the output files into the new cache directory
				async.mapSeries outputFiles, (file, cb) ->
					newFile = _.clone(file)
					[src, dst] = [Path.join(compileDir, file.path), Path.join(cacheDir, file.path)]
					checkFile src, (err) ->
						copyFile src, dst, (err) ->
							if not err?
								newFile.build = buildId  # attach a build id if we cached the file
							cb(err, newFile)
				, (err, results) ->
					if err?
						# pass back the original files if we encountered *any* error
						callback(err, outputFiles)
					else
						# pass back the list of new files in the cache
						callback(err, results)

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
				# remove any directories over the hard limit
				return true if index > OutputCacheManager.CACHE_LIMIT
				# we can get the build time from the directory name
				dirTime = parseInt(dir, 16)
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
