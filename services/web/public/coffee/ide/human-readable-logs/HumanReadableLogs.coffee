define [
	"libs/latex-log-parser"
	"ide/human-readable-logs/HumanReadableLogsRules"
], (LogParser, ruleset) ->
	parse : (rawLog, options) ->
		parsedLogEntries = LogParser.parse(rawLog, options)

		_getHumanReadableMessage = (logMessage) ->
			return rule.humanReadableMessage for rule in ruleset when rule.regexToMatch.test logMessage

		for entry in parsedLogEntries.all
			humanReadableMessage = _getHumanReadableMessage entry.message
			entry.humanReadableMessage = humanReadableMessage if humanReadableMessage?

		return parsedLogEntries
