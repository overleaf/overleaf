define [
	"libs/latex-log-parser"
	"ide/human-readable-logs/HumanReadableLogsRules"
], (LogParser, ruleset) ->
	parse : (rawLog, options) ->
		parsedLogEntries = LogParser.parse(rawLog, options)

		_getRule = (logMessage) ->
			return rule for rule in ruleset when rule.regexToMatch.test logMessage

		for entry in parsedLogEntries.all
			{ regexToMatch, humanReadableHint, extraInfoURL } = _getRule entry.message
			entry.ruleId = 'hint_' + regexToMatch.toString().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
			entry.humanReadableHint = humanReadableHint if humanReadableHint?
			entry.extraInfoURL = extraInfoURL if extraInfoURL?

		return parsedLogEntries
