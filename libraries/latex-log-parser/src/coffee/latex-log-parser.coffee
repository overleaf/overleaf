define ->
	# Define some constants
	LOG_WRAP_LIMIT = 79
	LATEX_WARNING_REGEX = /^LaTeX Warning: (.*)$/
	HBOX_WARNING_REGEX = /^(Over|Under)full \\(v|h)box/
	PACKAGE_WARNING_REGEX = /^(Package \b.+\b Warning:.*)$/
	# This is used to parse the line number from common latex warnings
	LINES_REGEX = /lines? ([0-9]+)/
	# This is used to parse the package name from the package warnings
	PACKAGE_REGEX = /^Package (\b.+\b) Warning/

	LogText = (text) ->
		@text = text.replace(/(\r\n)|\r/g, '\n')
		# Join any lines which look like they have wrapped.
		wrappedLines = @text.split('\n')
		@lines = [ wrappedLines[0] ]
		i = 1
		while i < wrappedLines.length
			# If the previous line is as long as the wrap limit then
			# append this line to it.
			# Some lines end with ... when LaTeX knows it's hit the limit
			# These shouldn't be wrapped.
			if wrappedLines[i - 1].length == LOG_WRAP_LIMIT and wrappedLines[i - 1].slice(-3) != '...'
				@lines[@lines.length - 1] += wrappedLines[i]
			else
				@lines.push wrappedLines[i]
			i++
		@row = 0
		return

	(->
		@nextLine = () ->
			@row++
			if @row >= @lines.length
				false
			else
				@lines[@row]

		@rewindLine = ->
			@row--
			return

		@linesUpToNextWhitespaceLine = () ->
			@linesUpToNextMatchingLine /^ *$/

		@linesUpToNextMatchingLine = (match) ->
			lines = []
			nextLine = @nextLine()
			if nextLine != false
				lines.push nextLine
			while nextLine != false and !nextLine.match(match) and nextLine != false
				nextLine = @nextLine()
				if nextLine != false
					lines.push nextLine
			lines

		return
	).call(LogText.prototype)

	state =
		NORMAL: 0
		ERROR: 1

	LatexParser = (text, options) ->
		@log = new LogText(text)
		@state = state.NORMAL
		options = options || {}
		@fileBaseNames = options.fileBaseNames || [
			/compiles/
			/\/usr\/local/
		]
		@ignoreDuplicates = options.ignoreDuplicates
		@data = []
		@fileStack = []
		@currentFileList = @rootFileList = []
		@openParens = 0
		return

	(->
		@parse = () ->
			while (@currentLine = @log.nextLine()) != false
				if @state == state.NORMAL
					if @currentLineIsError()
						@state = state.ERROR
						@currentError =
							line: null
							file: @currentFilePath
							level: 'error'
							message: @currentLine.slice(2)
							content: ''
							raw: @currentLine + '\n'
					else if @currentLineIsRunawayArgument()
						@parseRunawayArgumentError()
					else if @currentLineIsWarning()
						@parseSingleWarningLine LATEX_WARNING_REGEX
					else if @currentLineIsHboxWarning()
						@parseHboxLine()
					else if @currentLineIsPackageWarning()
						@parseMultipleWarningLine()
					else
						@parseParensForFilenames()
				if @state == state.ERROR
					@currentError.content += @log.linesUpToNextMatchingLine(/^l\.[0-9]+/).join('\n')
					@currentError.content += '\n'
					@currentError.content += @log.linesUpToNextWhitespaceLine().join('\n')
					@currentError.content += '\n'
					@currentError.content += @log.linesUpToNextWhitespaceLine().join('\n')
					@currentError.raw += @currentError.content
					lineNo = @currentError.raw.match(/l\.([0-9]+)/)
					if lineNo
						@currentError.line = parseInt(lineNo[1], 10)
					@data.push @currentError
					@state = state.NORMAL
			@postProcess @data

		@currentLineIsError = ->
			@currentLine[0] == '!'
		
		@currentLineIsRunawayArgument = ->
			@currentLine.match(/^Runaway argument/)

		@currentLineIsWarning = ->
			!!@currentLine.match(LATEX_WARNING_REGEX)

		@currentLineIsPackageWarning = ->
			!!@currentLine.match(PACKAGE_WARNING_REGEX)

		@currentLineIsHboxWarning = ->
			!!@currentLine.match(HBOX_WARNING_REGEX)
		
		@parseRunawayArgumentError = ->
			@currentError =
				line: null
				file: @currentFilePath
				level: 'error'
				message: @currentLine
				content: ''
				raw: @currentLine + '\n'
			@currentError.content += @log.linesUpToNextWhitespaceLine().join('\n')
			@currentError.content += '\n'
			@currentError.content += @log.linesUpToNextWhitespaceLine().join('\n')
			@currentError.raw += @currentError.content
			lineNo = @currentError.raw.match(/l\.([0-9]+)/)
			if lineNo
				@currentError.line = parseInt(lineNo[1], 10)
			@data.push @currentError

		@parseSingleWarningLine = (prefix_regex) ->
			warningMatch = @currentLine.match(prefix_regex)
			if !warningMatch
				return
			warning = warningMatch[1]
			lineMatch = warning.match(LINES_REGEX)
			line = if lineMatch then parseInt(lineMatch[1], 10) else null
			@data.push
				line: line
				file: @currentFilePath
				level: 'warning'
				message: warning
				raw: warning
			return

		@parseMultipleWarningLine = ->
			# Some package warnings are multiple lines, let's parse the first line
			warningMatch = @currentLine.match(PACKAGE_WARNING_REGEX)
			if !warningMatch
				return
			# Something strange happened, return early
			warning_lines = [ warningMatch[1] ]
			lineMatch = @currentLine.match(LINES_REGEX)
			line = if lineMatch then parseInt(lineMatch[1], 10) else null
			packageMatch = @currentLine.match(PACKAGE_REGEX)
			packageName = packageMatch[1]
			# Regex to get rid of the unnecesary (packagename) prefix in most multi-line warnings
			prefixRegex = new RegExp('(?:\\(' + packageName + '\\))*[\\s]*(.*)', 'i')
			# After every warning message there's a blank line, let's use it
			while !!(@currentLine = @log.nextLine())
				lineMatch = @currentLine.match(LINES_REGEX)
				line = if lineMatch then parseInt(lineMatch[1], 10) else line
				warningMatch = @currentLine.match(prefixRegex)
				warning_lines.push warningMatch[1]
			raw_message = warning_lines.join(' ')
			@data.push
				line: line
				file: @currentFilePath
				level: 'warning'
				message: raw_message
				raw: raw_message
			return

		@parseHboxLine = ->
			lineMatch = @currentLine.match(LINES_REGEX)
			line = if lineMatch then parseInt(lineMatch[1], 10) else null
			@data.push
				line: line
				file: @currentFilePath
				level: 'typesetting'
				message: @currentLine
				raw: @currentLine
			return

		# Check if we're entering or leaving a new file in this line

		@parseParensForFilenames = ->
			pos = @currentLine.search(/\(|\)/)
			if pos != -1
				token = @currentLine[pos]
				@currentLine = @currentLine.slice(pos + 1)
				if token == '('
					filePath = @consumeFilePath()
					if filePath
						@currentFilePath = filePath
						newFile =
							path: filePath
							files: []
						@fileStack.push newFile
						@currentFileList.push newFile
						@currentFileList = newFile.files
					else
						@openParens++
				else if token == ')'
					if @openParens > 0
						@openParens--
					else
						if @fileStack.length > 1
							@fileStack.pop()
							previousFile = @fileStack[@fileStack.length - 1]
							@currentFilePath = previousFile.path
							@currentFileList = previousFile.files
						# else {
						#		 Something has gone wrong but all we can do now is ignore it :(
						# }
				# Process the rest of the line
				@parseParensForFilenames()
			return

		@consumeFilePath = ->
			# Our heuristic for detecting file names are rather crude
			# A file may not contain a space, or ) in it
			# To be a file path it must have at least one /
			if !@currentLine.match(/^\/?([^ \)]+\/)+/)
				return false
			endOfFilePath = @currentLine.search(RegExp(' |\\)'))
			path = undefined
			if endOfFilePath == -1
				path = @currentLine
				@currentLine = ''
			else
				path = @currentLine.slice(0, endOfFilePath)
				@currentLine = @currentLine.slice(endOfFilePath)
			path

		@postProcess = (data) ->
			all = []
			errors = []
			warnings = []
			typesetting = []
			hashes = []

			hashEntry = (entry) ->
				entry.raw

			i = 0
			while i < data.length
				if (@ignoreDuplicates and hashes.indexOf(hashEntry(data[i])) > -1)
					i++
					continue
				if data[i].level == 'error'
					errors.push data[i]
				else if data[i].level == 'typesetting'
					typesetting.push data[i]
				else if data[i].level == 'warning'
					warnings.push data[i]
				all.push data[i]
				hashes.push hashEntry(data[i])
				i++
			return {
				errors: errors
				warnings: warnings
				typesetting: typesetting
				all: all
				files: @rootFileList
			}

	).call(LatexParser.prototype)

	LatexParser.parse = (text, options) ->
		new LatexParser(text, options).parse()

	LatexParser
