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

		seenErrorTypes = {} # keep track of types of errors seen

		for entry in parsedLogEntries.all
			ruleDetails = _getRule entry.message

			if (ruleDetails?)
				if ruleDetails.ruleId?
					entry.ruleId = ruleDetails.ruleId
				else if ruleDetails.regexToMatch?
					entry.ruleId = 'hint_' + ruleDetails.regexToMatch.toString().replace(/\s/g, '_').slice(1, -1)
				if ruleDetails.newMessage?
					entry.message = entry.message.replace ruleDetails.regexToMatch, ruleDetails.newMessage
				# suppress any entries that are known to cascade from previous error types
				if ruleDetails.cascadesFrom?
					for type in ruleDetails.cascadesFrom
						entry.suppressed = true if seenErrorTypes[type]
				# record the types of errors seen
				if ruleDetails.types?
					for type in ruleDetails.types
						seenErrorTypes[type] = true
				
				entry.humanReadableHint = ruleDetails.humanReadableHint if ruleDetails.humanReadableHint?
				entry.extraInfoURL = ruleDetails.extraInfoURL if ruleDetails.extraInfoURL?

		# filter out the suppressed errors (from the array entries in parsedLogEntries)
		for key, errors of parsedLogEntries when typeof errors is 'object' and errors.length > 0
			parsedLogEntries[key] = (err for err in errors when not err.suppressed)

		return parsedLogEntries
