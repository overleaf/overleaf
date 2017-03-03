Path = require "path"
Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
Metrics = require "./Metrics"
CommandRunner = require(Settings.clsi?.commandRunner or "./CommandRunner")

ProcessTable = {}  # table of currently running jobs (pids or docker container names)

module.exports = LatexRunner =
	runLatex: (project_id, options, callback = (error) ->) ->
		{directory, mainFile, compiler, timeout, image, environment} = options
		compiler ||= "pdflatex"
		timeout  ||= 60000 # milliseconds

		logger.log directory: directory, compiler: compiler, timeout: timeout, mainFile: mainFile, environment: environment, "starting compile"

		# We want to run latexmk on the tex file which we will automatically
		# generate from the Rtex/Rmd/md file.
		mainFile = mainFile.replace(/\.(Rtex|md|Rmd)$/, ".tex")

		if compiler == "pdflatex"
			command = LatexRunner._pdflatexCommand mainFile
		else if compiler == "latex"
			command = LatexRunner._latexCommand mainFile
		else if compiler == "xelatex"
			command = LatexRunner._xelatexCommand mainFile
		else if compiler == "lualatex"
			command = LatexRunner._lualatexCommand mainFile
		else
			return callback new Error("unknown compiler: #{compiler}")
		
		if Settings.clsi?.strace
			command = ["strace", "-o", "strace", "-ff"].concat(command)

		id = "#{project_id}" # record running project under this id

		ProcessTable[id] = CommandRunner.run project_id, command, directory, image, timeout, environment, (error, output) ->
			delete ProcessTable[id]
			return callback(error) if error?
			runs = output?.stderr?.match(/^Run number \d+ of .*latex/mg)?.length or 0
			failed = if output?.stdout?.match(/^Latexmk: Errors/m)? then 1 else 0
			# counters from latexmk output
			stats = {}
			stats["latexmk-errors"] = failed
			stats["latex-runs"] = runs
			stats["latex-runs-with-errors"] = if failed then runs else 0
			stats["latex-runs-#{runs}"] = 1
			stats["latex-runs-with-errors-#{runs}"] = if failed then 1 else 0
			# timing information from /usr/bin/time
			timings = {}
			stderr = output?.stderr
			timings["cpu-percent"] = stderr?.match(/Percent of CPU this job got: (\d+)/m)?[1] or 0
			timings["cpu-time"] = stderr?.match(/User time.*: (\d+.\d+)/m)?[1] or 0
			timings["sys-time"] = stderr?.match(/System time.*: (\d+.\d+)/m)?[1] or 0
			callback error, output, stats, timings

	killLatex: (project_id, callback = (error) ->) ->
		id = "#{project_id}"
		logger.log {id:id}, "killing running compile"
		if not ProcessTable[id]?
			return callback new Error("no such project to kill")
		else
			CommandRunner.kill ProcessTable[id], callback

	_latexmkBaseCommand: (Settings?.clsi?.latexmkCommandPrefix || []).concat([
		"latexmk", "-cd", "-f", "-jobname=output", "-auxdir=$COMPILE_DIR", "-outdir=$COMPILE_DIR",
		"-synctex=1","-interaction=batchmode"
		])

	_pdflatexCommand: (mainFile) ->
		LatexRunner._latexmkBaseCommand.concat [
			"-pdf",
			Path.join("$COMPILE_DIR", mainFile)
		]
		
	_latexCommand: (mainFile) ->
		LatexRunner._latexmkBaseCommand.concat [
			"-pdfdvi",
			Path.join("$COMPILE_DIR", mainFile)
		]

	_xelatexCommand: (mainFile) ->
		LatexRunner._latexmkBaseCommand.concat [
			"-xelatex",
			Path.join("$COMPILE_DIR", mainFile)
		]

	_lualatexCommand: (mainFile) ->
		LatexRunner._latexmkBaseCommand.concat [
			"-lualatex",
			Path.join("$COMPILE_DIR", mainFile)
		]

