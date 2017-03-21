fs = require "fs"
Path = require "path"
ResourceWriter = require "./ResourceWriter"
logger = require "logger-sharelatex"

# for \tikzexternalize to work the main file needs to match the
# jobname.  Since we set the -jobname to output, we have to create a
# copy of the main file as 'output.tex'.

module.exports = TikzManager =
	needsOutputFile: (rootResourcePath, resources) ->
		# if there's already an output.tex file, we don't want to touch it
		for resource in resources
			if resource.path is "output.tex"
				return false
		# if there's no output.tex, see if we are using tikz/pgf in the main file
		for resource in resources
			if resource.path is rootResourcePath
				return TikzManager._includesTikz (resource)
		# otherwise false
		return false

	_includesTikz: (resource) ->
		# check if we are loading tikz or pgf
		content = resource.content.slice(0,4096)
		if content.indexOf("\\usepackage{tikz") >= 0
			return true
		else if content.indexOf("\\usepackage{pgf") >= 0
			return true
		else
			return false

	injectOutputFile: (compileDir, mainFile, callback = (error) ->) ->
		ResourceWriter.checkPath compileDir, mainFile, (error, path) ->
			return callback(error) if error?
			fs.readFile path, "utf8", (error, content) ->
				return callback(error) if error?
				logger.log compileDir: compileDir, mainFile: mainFile, "copied file to ouput.tex for tikz"
				# use wx flag to ensure that output file does not already exist
				fs.writeFile Path.join(compileDir, "output.tex"), content, {flag:'wx'}, callback
