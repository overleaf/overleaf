fs = require "fs"
Path = require "path"
ResourceWriter = require "./ResourceWriter"
SafeReader = require "./SafeReader"
logger = require "logger-sharelatex"

# for \tikzexternalize or pstool to work the main file needs to match the
# jobname.  Since we set the -jobname to output, we have to create a
# copy of the main file as 'output.tex'.

module.exports = TikzManager =

	checkMainFile: (compileDir, mainFile, resources, callback = (error, needsMainFile) ->) ->
		# if there's already an output.tex file, we don't want to touch it
		for resource in resources
			if resource.path is "output.tex"
				logger.log compileDir: compileDir, mainFile: mainFile, "output.tex already in resources"
				return callback(null, false)
		# if there's no output.tex, see if we are using tikz/pgf or pstool in the main file
		ResourceWriter.checkPath compileDir, mainFile, (error, path) ->
			return callback(error) if error?
			SafeReader.readFile path, 65536, "utf8", (error, content) ->
				return callback(error) if error?
				usesTikzExternalize = content?.indexOf("\\tikzexternalize") >= 0
				usesPsTool = content.indexOf("{pstool}") >= 0
				logger.log compileDir: compileDir, mainFile: mainFile, usesTikzExternalize:usesTikzExternalize, usesPsTool: usesPsTool, "checked for packages needing main file as output.tex"
				needsMainFile = (usesTikzExternalize || usesPsTool)
				callback null, needsMainFile

	injectOutputFile: (compileDir, mainFile, callback = (error) ->) ->
		ResourceWriter.checkPath compileDir, mainFile, (error, path) ->
			return callback(error) if error?
			fs.readFile path, "utf8", (error, content) ->
				return callback(error) if error?
				logger.log compileDir: compileDir, mainFile: mainFile, "copied file to output.tex as project uses packages which require it"
				# use wx flag to ensure that output file does not already exist
				fs.writeFile Path.join(compileDir, "output.tex"), content, {flag:'wx'}, callback
