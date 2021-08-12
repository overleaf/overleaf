define ->

	# [fullLine, lineNumber, messageType, message]
	LINE_SPLITTER_REGEX = /^\[(\d+)].*>\s(INFO|WARN|ERROR)\s-\s(.*)$/

	MESSAGE_LEVELS = {
		"INFO": "info"
		"WARN": "warning"
		"ERROR": "error"
	}

	BibLogParser = (text, options) ->
		if typeof text != 'string'
			throw new Error("BibLogParser Error: text parameter must be a string")
		@text = text.replace(/(\r\n)|\r/g, '\n')
		@options = options || {}
		@lines = text.split('\n')
		return

	consume = (logText, regex, process) ->
		text = logText
		result = []
		re = regex
		iterationCount = 0
		while match = re.exec(text)
			iterationCount += 1
			if iterationCount >= 10000
				return result
			newEntry = process(match)
			result.push newEntry
			text = (
				(match.input.slice(0, match.index)) +
				(match.input.slice(match.index+match[0].length+1, match.input.length))
			)
		return [result, text]

	MULTILINE_WARNING_REGEX = /^Warning--(.+)\n--line (\d+) of file (.+)$/m
	SINGLELINE_WARNING_REGEX = /^Warning--(.+)$/m
	MULTILINE_ERROR_REGEX = /^(.*)---line (\d+) of file (.*)\n([^]+?)\nI'm skipping whatever remains of this entry$/m
	BAD_CROSS_REFERENCE_REGEX = /^(A bad cross reference---entry ".+?"\nrefers to entry.+?, which doesn't exist)$/m
	MULTILINE_COMMAND_ERROR_REGEX = /^(.*)\n?---line (\d+) of file (.*)\n([^]+?)\nI'm skipping whatever remains of this command$/m

	# each parser is a pair of [regex, processFunction], where processFunction
	# describes how to transform the regex mactch into a log entry object.
	warningParsers = [
		[
			MULTILINE_WARNING_REGEX,
			(match) ->
				[fullMatch, message, lineNumber, fileName] = match
				{
					file: fileName,
					level: "warning",
					message: message,
					line: lineNumber,
					raw: fullMatch
				}
		],
		[
			SINGLELINE_WARNING_REGEX,
			(match) ->
				[fullMatch, message] = match
				{
					file: '',
					level: "warning",
					message: message,
					line: '',
					raw: fullMatch
				}
		]
	]
	errorParsers = [
		[
			MULTILINE_ERROR_REGEX,
			(match) ->
				[fullMatch, firstMessage, lineNumber, fileName, secondMessage] = match
				{
					file: fileName,
					level: "error",
					message: firstMessage + '\n' + secondMessage,
					line: lineNumber,
					raw: fullMatch
				}
		],
		[
			BAD_CROSS_REFERENCE_REGEX,
			(match) ->
				[fullMatch, message] = match
				{
					file: '',
					level: "error",
					message: message,
					line: '',
					raw: fullMatch
				}
		],
		[
			MULTILINE_COMMAND_ERROR_REGEX,
			(match) ->
				[fullMatch, firstMessage, lineNumber, fileName, secondMessage] = match
				{
					file: fileName,
					level: "error",
					message: firstMessage + '\n' + secondMessage,
					line: lineNumber,
					raw: fullMatch
				}
		]
	]

	(->
		@parseBibtex = () ->
			result = {
				all: [],
				errors: [],
				warnings: [],
				files: [],       # not used
				typesetting: []  # not used
			}
			# reduce over the parsers, starting with the log text,
			[allWarnings, remainingText] = warningParsers.reduce(
				(accumulator, parser) ->
					[currentWarnings, text] = accumulator
					[regex, process] = parser
					[warnings, _remainingText] = consume text, regex, process
					return [currentWarnings.concat(warnings), _remainingText]
				, [[], @text]
			)
			[allErrors, remainingText] = errorParsers.reduce(
				(accumulator, parser) ->
					[currentErrors, text] = accumulator
					[regex, process] = parser
					[errors, _remainingText] = consume text, regex, process
					return [currentErrors.concat(errors), _remainingText]
				, [[], remainingText]
			)
			result.warnings = allWarnings
			result.errors = allErrors
			result.all = allWarnings.concat(allErrors)
			return result

		@parseBiber = () ->
			result = {
				all: [],
				errors: [],
				warnings: [],
				files: [],       # not used
				typesetting: []  # not used
			}
			@lines.forEach (line) ->
				match = line.match(LINE_SPLITTER_REGEX)
				if match
					[fullLine, lineNumber, messageType, message] = match
					newEntry = {
						file: '',
						level: MESSAGE_LEVELS[messageType] || "INFO",
						message: message,
						line: '',
						raw: fullLine
					}
					# try extract file, line-number and the 'real' message from lines like:
					#   BibTeX subsystem: /.../original.bib_123.utf8, line 8, syntax error: it's bad
					lineMatch = newEntry.message.match(/^BibTeX subsystem: \/.+\/(\w+\.\w+)_.+, line (\d+), (.+)$/)
					if lineMatch && lineMatch.length == 4
						[_, fileName, lineNumber, realMessage] = lineMatch
						newEntry.file = fileName
						newEntry.line = lineNumber
						newEntry.message = realMessage
					result.all.push newEntry
					switch newEntry.level
						when 'error' then result.errors.push newEntry
						when 'warning'  then result.warnings.push newEntry
			return result

		@parse = () ->
			firstLine = @lines[0]
			if firstLine.match(/^.*INFO - This is Biber.*$/)
				@parseBiber()
			else if firstLine.match(/^This is BibTeX, Version.+$/)
				@parseBibtex()
			else
				throw new Error("BibLogParser Error: cannot determine whether text is biber or bibtex output")

	).call(BibLogParser.prototype)

	BibLogParser.parse = (text, options) ->
		new BibLogParser(text, options).parse()

	return BibLogParser
