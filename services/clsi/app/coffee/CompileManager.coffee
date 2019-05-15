ResourceWriter = require "./ResourceWriter"
LatexRunner = require "./LatexRunner"
OutputFileFinder = require "./OutputFileFinder"
OutputCacheManager = require "./OutputCacheManager"
Settings = require("settings-sharelatex")
Path = require "path"
logger = require "logger-sharelatex"
Metrics = require "./Metrics"
child_process = require "child_process"
DraftModeManager = require "./DraftModeManager"
TikzManager = require "./TikzManager"
LockManager = require "./LockManager"
fs = require("fs")
fse = require "fs-extra"
os = require("os")
async = require "async"
Errors = require './Errors'
CommandRunner = require "./CommandRunner"

getCompileName = (project_id, user_id) ->
	if user_id? then "#{project_id}-#{user_id}" else project_id

getCompileDir = (project_id, user_id) ->
	Path.join(Settings.path.compilesDir, getCompileName(project_id, user_id))

module.exports = CompileManager =

	doCompileWithLock: (request, callback = (error, outputFiles) ->) ->
		compileDir = getCompileDir(request.project_id, request.user_id)
		lockFile = Path.join(compileDir, ".project-lock")
		# use a .project-lock file in the compile directory to prevent
		# simultaneous compiles
		fse.ensureDir compileDir, (error) ->
			return callback(error) if error?
			LockManager.runWithLock lockFile, (releaseLock) ->
				CompileManager.doCompile(request, releaseLock)
			, callback

	doCompile: (request, callback = (error, outputFiles) ->) ->
		compileDir = getCompileDir(request.project_id, request.user_id)
		timer = new Metrics.Timer("write-to-disk")
		logger.log project_id: request.project_id, user_id: request.user_id, "syncing resources to disk"
		ResourceWriter.syncResourcesToDisk request, compileDir, (error, resourceList) ->
			# NOTE: resourceList is insecure, it should only be used to exclude files from the output list
			if error? and error instanceof Errors.FilesOutOfSyncError
				logger.warn project_id: request.project_id, user_id: request.user_id, "files out of sync, please retry"
				return callback(error)
			else if error?
				logger.err err:error, project_id: request.project_id, user_id: request.user_id, "error writing resources to disk"
				return callback(error)
			logger.log project_id: request.project_id, user_id: request.user_id, time_taken: Date.now() - timer.start, "written files to disk"
			timer.done()

			injectDraftModeIfRequired = (callback) ->
				if request.draft
					DraftModeManager.injectDraftMode Path.join(compileDir, request.rootResourcePath), callback
				else
					callback()

			createTikzFileIfRequired = (callback) ->
				TikzManager.checkMainFile compileDir, request.rootResourcePath, resourceList, (error, needsMainFile) ->
					return callback(error) if error?
					if needsMainFile
						TikzManager.injectOutputFile compileDir, request.rootResourcePath, callback
					else
						callback()

			# set up environment variables for chktex
			env = {}
			# only run chktex on LaTeX files (not knitr .Rtex files or any others)
			isLaTeXFile = request.rootResourcePath?.match(/\.tex$/i)
			if request.check? and isLaTeXFile
				env['CHKTEX_OPTIONS'] = '-nall -e9 -e10 -w15 -w16'
				env['CHKTEX_ULIMIT_OPTIONS'] = '-t 5 -v 64000'
				if request.check is 'error'
					env['CHKTEX_EXIT_ON_ERROR'] =  1
				if request.check is 'validate'
					env['CHKTEX_VALIDATE'] =  1

			# apply a series of file modifications/creations for draft mode and tikz
			async.series [injectDraftModeIfRequired, createTikzFileIfRequired], (error) ->
				return callback(error) if error?
				timer = new Metrics.Timer("run-compile")
				# find the image tag to log it as a metric, e.g. 2015.1 (convert . to - for graphite)
				tag = request.imageName?.match(/:(.*)/)?[1]?.replace(/\./g,'-') or "default"
				tag = "other" if not request.project_id.match(/^[0-9a-f]{24}$/) # exclude smoke test
				Metrics.inc("compiles")
				Metrics.inc("compiles-with-image.#{tag}")
				compileName = getCompileName(request.project_id, request.user_id)
				LatexRunner.runLatex compileName, {
					directory: compileDir
					mainFile:  request.rootResourcePath
					compiler:  request.compiler
					timeout:   request.timeout
					image:     request.imageName
					flags:     request.flags
					environment: env
				}, (error, output, stats, timings) ->
					# request was for validation only
					if request.check is "validate"
						result = if error?.code then "fail" else "pass"
						error = new Error("validation")
						error.validate = result
					# request was for compile, and failed on validation
					if request.check is "error" and error?.message is 'exited'
						error = new Error("compilation")
						error.validate = "fail"
					# compile was killed by user, was a validation, or a compile which failed validation
					if error?.terminated or error?.validate
						OutputFileFinder.findOutputFiles resourceList, compileDir, (err, outputFiles) ->
							return callback(err) if err?
							callback(error, outputFiles) # return output files so user can check logs
						return
					# compile completed normally
					return callback(error) if error?
					Metrics.inc("compiles-succeeded")
					for metric_key, metric_value of stats or {}
						Metrics.count(metric_key, metric_value)
					for metric_key, metric_value of timings or {}
						Metrics.timing(metric_key, metric_value)
					loadavg = os.loadavg?()
					Metrics.gauge("load-avg", loadavg[0]) if loadavg?
					ts = timer.done()
					logger.log {project_id: request.project_id, user_id: request.user_id, time_taken: ts, stats:stats, timings:timings, loadavg:loadavg}, "done compile"
					if stats?["latex-runs"] > 0
						Metrics.timing("run-compile-per-pass", ts / stats["latex-runs"])
					if stats?["latex-runs"] > 0 and timings?["cpu-time"] > 0
						Metrics.timing("run-compile-cpu-time-per-pass", timings["cpu-time"] / stats["latex-runs"])

					OutputFileFinder.findOutputFiles resourceList, compileDir, (error, outputFiles) ->
						return callback(error) if error?
						OutputCacheManager.saveOutputFiles outputFiles, compileDir,  (error, newOutputFiles) ->
							callback null, newOutputFiles

	stopCompile: (project_id, user_id, callback = (error) ->) ->
		compileName = getCompileName(project_id, user_id)
		LatexRunner.killLatex compileName, callback

	clearProject: (project_id, user_id, _callback = (error) ->) ->
		callback = (error) ->
			_callback(error)
			_callback = () ->

		compileDir = getCompileDir(project_id, user_id)

		CompileManager._checkDirectory compileDir, (err, exists) ->
			return callback(err) if err?
			return callback() if not exists # skip removal if no directory present

			proc = child_process.spawn "rm", ["-r", compileDir]

			proc.on "error", callback

			stderr = ""
			proc.stderr.on "data", (chunk) -> stderr += chunk.toString()

			proc.on "close", (code) ->
				if code == 0
					return callback(null)
				else
					return callback(new Error("rm -r #{compileDir} failed: #{stderr}"))

	_findAllDirs: (callback = (error, allDirs) ->) ->
		root = Settings.path.compilesDir
		fs.readdir root, (err, files) ->
			return callback(err) if err?
			allDirs = (Path.join(root, file) for file in files)
			callback(null, allDirs)

	clearExpiredProjects: (max_cache_age_ms, callback = (error) ->) ->
		now = Date.now()
		# action for each directory
		expireIfNeeded = (checkDir, cb) ->
			fs.stat checkDir, (err, stats) ->
				return cb() if err?  # ignore errors checking directory
				age = now - stats.mtime
				hasExpired = (age > max_cache_age_ms)
				if hasExpired then fse.remove(checkDir, cb) else cb()
		# iterate over all project directories
		CompileManager._findAllDirs (error, allDirs) ->
			return callback() if error?
			async.eachSeries allDirs, expireIfNeeded,	callback

	_checkDirectory: (compileDir, callback = (error, exists) ->) ->
		fs.lstat compileDir, (err, stats) ->
			if err?.code is 'ENOENT'
				return callback(null, false) #  directory does not exist
			else if err?
				logger.err {dir: compileDir, err:err}, "error on stat of project directory for removal"
				return callback(err)
			else if not stats?.isDirectory()
				logger.err {dir: compileDir, stats:stats}, "bad project directory for removal"
				return callback new Error("project directory is not directory")
			else
				callback(null, true) # directory exists

	syncFromCode: (project_id, user_id, file_name, line, column, callback = (error, pdfPositions) ->) ->
		# If LaTeX was run in a virtual environment, the file path that synctex expects
		# might not match the file path on the host. The .synctex.gz file however, will be accessed
		# wherever it is on the host.
		compileName = getCompileName(project_id, user_id)
		base_dir = Settings.path.synctexBaseDir(compileName)
		file_path = base_dir + "/" + file_name
		compileDir = getCompileDir(project_id, user_id)
		synctex_path =  "#{base_dir}/output.pdf"
		command = ["code", synctex_path, file_path, line, column]
		fse.ensureDir compileDir, (error) ->
			if error?
				logger.err {error, project_id, user_id, file_name}, "error ensuring dir for sync from code"
				return callback(error)
			CompileManager._runSynctex project_id, user_id, command, (error, stdout) ->
				return callback(error) if error?
				logger.log project_id: project_id, user_id:user_id, file_name: file_name, line: line, column: column, command:command, stdout: stdout, "synctex code output"
				callback null, CompileManager._parseSynctexFromCodeOutput(stdout)

	syncFromPdf: (project_id, user_id, page, h, v, callback = (error, filePositions) ->) ->
		compileName = getCompileName(project_id, user_id)
		compileDir = getCompileDir(project_id, user_id)
		base_dir = Settings.path.synctexBaseDir(compileName)
		synctex_path =  "#{base_dir}/output.pdf"
		command = ["pdf", synctex_path, page, h, v]
		fse.ensureDir compileDir, (error) ->
			if error?
				logger.err {error, project_id, user_id, file_name}, "error ensuring dir for sync to code"
				return callback(error)
			CompileManager._runSynctex  project_id, user_id, command, (error, stdout) ->
				return callback(error) if error?
				logger.log project_id: project_id, user_id:user_id, page: page, h: h, v:v, stdout: stdout, "synctex pdf output"
				callback null, CompileManager._parseSynctexFromPdfOutput(stdout, base_dir)

	_checkFileExists: (path, callback = (error) ->) ->
		synctexDir = Path.dirname(path)
		synctexFile = Path.join(synctexDir, "output.synctex.gz")
		fs.stat synctexDir, (error, stats) ->
			if error?.code is 'ENOENT'
				return callback(new Errors.NotFoundError("called synctex with no output directory"))
			return callback(error) if error?
			fs.stat synctexFile, (error, stats) ->
				if error?.code is 'ENOENT'
					return callback(new Errors.NotFoundError("called synctex with no output file"))
				return callback(error) if error?
				return callback(new Error("not a file")) if not stats?.isFile()
				callback()

	_runSynctex: (project_id, user_id, command, callback = (error, stdout) ->) ->
		seconds = 1000

		command.unshift("/opt/synctex")

		directory = getCompileDir(project_id, user_id)
		timeout = 60 * 1000 # increased to allow for large projects
		compileName = getCompileName(project_id, user_id)
		CommandRunner.run compileName, command, directory, Settings.clsi.docker.image, timeout, {}, (error, output) ->
			if error?
				logger.err err:error, command:command, project_id:project_id, user_id:user_id, "error running synctex"
				return callback(error)
			callback(null, output.stdout)

	_parseSynctexFromCodeOutput: (output) ->
		results = []
		for line in output.split("\n")
			[node, page, h, v, width, height] = line.split("\t")
			if node == "NODE"
				results.push {
					page:   parseInt(page, 10)
					h:      parseFloat(h)
					v:      parseFloat(v)
					height: parseFloat(height)
					width:  parseFloat(width)
				}
		return results

	_parseSynctexFromPdfOutput: (output, base_dir) ->
		results = []
		for line in output.split("\n")
			[node, file_path, line, column] = line.split("\t")
			if node == "NODE"
				file = file_path.slice(base_dir.length + 1)
				results.push {
					file: file
					line: parseInt(line, 10)
					column: parseInt(column, 10)
				}
		return results


	wordcount: (project_id, user_id, file_name, image, callback = (error, pdfPositions) ->) ->
		logger.log project_id:project_id, user_id:user_id, file_name:file_name, image:image, "running wordcount"
		file_path = "$COMPILE_DIR/" + file_name
		command = [ "texcount", '-nocol', '-inc', file_path, "-out=" + file_path + ".wc"]
		compileDir = getCompileDir(project_id, user_id)
		timeout = 60 * 1000
		compileName = getCompileName(project_id, user_id)
		fse.ensureDir compileDir, (error) ->
			if error?
				logger.err {error, project_id, user_id, file_name}, "error ensuring dir for sync from code"
				return callback(error)
			CommandRunner.run compileName, command, compileDir, image, timeout, {}, (error) ->
				return callback(error) if error?
				fs.readFile compileDir + "/" + file_name + ".wc", "utf-8", (err, stdout) ->
					if err?
						#call it node_err so sentry doesn't use random path error as unique id so it can't be ignored
						logger.err node_err:err, command:command, compileDir:compileDir, project_id:project_id, user_id:user_id, "error reading word count output"
						return callback(err)
					results = CompileManager._parseWordcountFromOutput(stdout)
					logger.log project_id:project_id, user_id:user_id, wordcount: results, "word count results"
					callback null, results

	_parseWordcountFromOutput: (output) ->
		results = {
			encode: ""
			textWords: 0
			headWords: 0
			outside: 0
			headers: 0
			elements: 0
			mathInline: 0
			mathDisplay: 0
			errors: 0
			messages: ""
		}
		for line in output.split("\n")
			[data, info] = line.split(":")
			if data.indexOf("Encoding") > -1
				results['encode'] = info.trim()
			if data.indexOf("in text") > -1
				results['textWords'] = parseInt(info, 10)
			if data.indexOf("in head") > -1
				results['headWords'] = parseInt(info, 10)
			if data.indexOf("outside") > -1
				results['outside'] = parseInt(info, 10)
			if data.indexOf("of head") > -1
				results['headers'] = parseInt(info, 10)
			if data.indexOf("Number of floats/tables/figures") > -1
				results['elements'] = parseInt(info, 10)
			if data.indexOf("Number of math inlines") > -1
				results['mathInline'] = parseInt(info, 10)
			if data.indexOf("Number of math displayed") > -1
				results['mathDisplay'] = parseInt(info, 10)
			if data is "(errors"  # errors reported as (errors:123)
				results['errors'] = parseInt(info, 10)
			if line.indexOf("!!! ") > -1  # errors logged as !!! message !!!
				results['messages'] += line + "\n"
		return results
