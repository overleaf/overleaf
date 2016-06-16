define [
	"libs/latex-log-parser"
], (LogParser) ->
	parse : (rawLog, options) ->
		parsedLogEntries = LogParser.parse(rawLog, options)
		return parsedLogEntries
