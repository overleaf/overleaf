define [
	"libs/latex-log-parser"
	"ide/human-readable-logs/HumanReadableLogsRules"
], (LogParser, ruleset) ->
	parse : (rawLog, options) ->
		parsedLogEntries = LogParser.parse(rawLog, options)

		_getRule = (logMessage) ->
			return rule for rule in ruleset when rule.regexToMatch.test logMessage

		for entry in parsedLogEntries.all
			ruleDetails = _getRule entry.message

			if (ruleDetails?)
				entry.ruleId = 'hint_' + ruleDetails.regexToMatch.toString().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() if ruleDetails.regexToMatch?
				entry.humanReadableHint = ruleDetails.humanReadableHint if ruleDetails.humanReadableHint?
				entry.extraInfoURL = ruleDetails.extraInfoURL if ruleDetails.extraInfoURL?
	
		return parsedLogEntries
