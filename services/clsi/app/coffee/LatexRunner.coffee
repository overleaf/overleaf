Path = require "path"
Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
Metrics = require "./Metrics"
CommandRunner = require(Settings.clsi?.commandRunner or "./CommandRunner")

module.exports = LatexRunner =
	runLatex: (project_id, options, callback = (error) ->) ->
		{directory, mainFile, compiler, timeout} = options
		compiler ||= "pdflatex"
		timeout  ||= 60000 # milliseconds

		logger.log directory: directory, compiler: compiler, timeout: timeout, mainFile: mainFile, "starting compile"

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

		CommandRunner.run project_id, command, directory, timeout, callback

	_latexmkBaseCommand: [ "latexmk", "-cd", "-f", "-jobname=output", "-auxdir=$COMPILE_DIR", "-outdir=$COMPILE_DIR"]

	_pdflatexCommand: (mainFile) ->
		LatexRunner._latexmkBaseCommand.concat [
			"-pdf", "-e", "$pdflatex='pdflatex -synctex=1 -interaction=batchmode %O %S'",
			Path.join("$COMPILE_DIR", mainFile)
		]
		
	_latexCommand: (mainFile) ->
		LatexRunner._latexmkBaseCommand.concat [
			"-pdfdvi", "-e", "$latex='latex -synctex=1 -interaction=batchmode %O %S'",
			Path.join("$COMPILE_DIR", mainFile)
		]

	_xelatexCommand: (mainFile) ->
		LatexRunner._latexmkBaseCommand.concat [
			"-xelatex", "-e", "$pdflatex='xelatex -synctex=1 -interaction=batchmode %O %S'",
			Path.join("$COMPILE_DIR", mainFile)
		]

	_lualatexCommand: (mainFile) ->
		LatexRunner._latexmkBaseCommand.concat [
			"-pdf", "-e", "$pdflatex='lualatex -synctex=1 -interaction=batchmode %O %S'",
			Path.join("$COMPILE_DIR", mainFile)
		]

