define [
	"libs/latex-log-parser"
	"ide/human-readable-logs/HumanReadableLogsRules"
], (LogParser, ruleset) ->
	parse : (rawLog, options) ->
		if typeof rawLog is 'string'
			parsedLogEntries = LogParser.parse(rawLog, options)
		else
			parsedLogEntries = rawLog

		_getRule = (logMessage) ->
			return rule for rule in ruleset when rule.regexToMatch.test logMessage

		for entry in parsedLogEntries.all
			ruleDetails = _getRule entry.message

			if (ruleDetails?)
				if ruleDetails.ruleId?
					entry.ruleId = ruleDetails.ruleId
				else if ruleDetails.regexToMatch?
					entry.ruleId = 'hint_' + ruleDetails.regexToMatch.toString().replace(/\s/g, '_').slice(1, -1)
				if ruleDetails.newMessage?
					entry.message = entry.message.replace ruleDetails.regexToMatch, ruleDetails.newMessage
				
				entry.humanReadableHint = ruleDetails.humanReadableHint if ruleDetails.humanReadableHint?
				entry.extraInfoURL = ruleDetails.extraInfoURL if ruleDetails.extraInfoURL?
	
		return parsedLogEntries
