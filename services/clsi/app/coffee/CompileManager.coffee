ResourceWriter = require "./ResourceWriter"
LatexRunner = require "./LatexRunner"
OutputFileFinder = require "./OutputFileFinder"
Settings = require("settings-sharelatex")
Path = require "path"
logger = require "logger-sharelatex"
Metrics = require "./Metrics"
child_process = require "child_process"

module.exports = CompileManager =
	doCompile: (request, callback = (error, outputFiles) ->) ->
		compileDir = Path.join(Settings.path.compilesDir, request.project_id)

		timer = new Metrics.Timer("write-to-disk")
		logger.log project_id: request.project_id, "starting compile"
		ResourceWriter.syncResourcesToDisk request.project_id, request.resources, compileDir, (error) ->
			return callback(error) if error?
			logger.log project_id: request.project_id, time_taken: Date.now() - timer.start, "written files to disk"
			timer.done()

			timer = new Metrics.Timer("run-compile")
			Metrics.inc("compiles")
			LatexRunner.runLatex request.project_id, {
				directory: compileDir
				mainFile:  request.rootResourcePath
				compiler:  request.compiler
				timeout:   request.timeout
			}, (error) ->
				return callback(error) if error?
				logger.log project_id: request.project_id, time_taken: Date.now() - timer.start, "done compile"
				timer.done()

				OutputFileFinder.findOutputFiles request.resources, compileDir, (error, outputFiles) ->
					return callback(error) if error?
					callback null, outputFiles
	
	clearProject: (project_id, _callback = (error) ->) ->
		callback = (error) ->
			_callback(error)
			_callback = () ->

		compileDir = Path.join(Settings.path.compilesDir, project_id)
		proc = child_process.spawn "rm", ["-r", compileDir]

		proc.on "error", callback

		stderr = ""
		proc.stderr.on "data", (chunk) -> stderr += chunk.toString()

		proc.on "close", (code) ->
			if code == 0
				return callback(null)
			else
				return callback(new Error("rm -r #{compileDir} failed: #{stderr}"))
