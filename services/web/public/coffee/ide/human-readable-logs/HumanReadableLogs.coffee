define [
	"libs/latex-log-parser"
	"ide/human-readable-logs/HumanReadableLogsRules"
], (LogParser, ruleset) ->
	parse : (rawLog, options) ->
		parsedLogEntries = LogParser.parse(rawLog, options)

		_getRule = (logMessage) ->
			return rule for rule in ruleset when rule.regexToMatch.test logMessage

		for entry in parsedLogEntries.all
			{ humanReadableHint, extraInfoURL } = _getRule entry.message
			entry.humanReadableHint = humanReadableHint if humanReadableHint?
			entry.extraInfoURL = extraInfoURL if extraInfoURL?

		return parsedLogEntries
