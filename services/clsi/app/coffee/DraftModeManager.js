fs = require "fs"
logger = require "logger-sharelatex"

module.exports = DraftModeManager =
	injectDraftMode: (filename, callback = (error) ->) ->
		fs.readFile filename, "utf8", (error, content) ->
			return callback(error) if error?
			# avoid adding draft mode more than once
			if content?.indexOf("\\documentclass\[draft") >= 0
				return callback()
			modified_content = DraftModeManager._injectDraftOption content
			logger.log {
				content: content.slice(0,1024), # \documentclass is normally v near the top
				modified_content: modified_content.slice(0,1024),
				filename
			}, "injected draft class"
			fs.writeFile filename, modified_content, callback
	
	_injectDraftOption: (content) ->
		content
			# With existing options (must be first, otherwise both are applied)
			.replace(/\\documentclass\[/g, "\\documentclass[draft,")
			# Without existing options
			.replace(/\\documentclass\{/g, "\\documentclass[draft]{")
