/* eslint-disable
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'libs/latex-log-parser',
  'ide/human-readable-logs/HumanReadableLogsRules'
], (LogParser, ruleset) => ({
  parse(rawLog, options) {
    let parsedLogEntries
    if (typeof rawLog === 'string') {
      parsedLogEntries = LogParser.parse(rawLog, options)
    } else {
      parsedLogEntries = rawLog
    }

    const _getRule = function(logMessage) {
      for (let rule of Array.from(ruleset)) {
        if (rule.regexToMatch.test(logMessage)) {
          return rule
        }
      }
    }

    const seenErrorTypes = {} // keep track of types of errors seen

    for (let entry of Array.from(parsedLogEntries.all)) {
      const ruleDetails = _getRule(entry.message)

      if (ruleDetails != null) {
        var type
        if (ruleDetails.ruleId != null) {
          entry.ruleId = ruleDetails.ruleId
        } else if (ruleDetails.regexToMatch != null) {
          entry.ruleId = `hint_${ruleDetails.regexToMatch
            .toString()
            .replace(/\s/g, '_')
            .slice(1, -1)}`
        }
        if (ruleDetails.newMessage != null) {
          entry.message = entry.message.replace(
            ruleDetails.regexToMatch,
            ruleDetails.newMessage
          )
        }
        // suppress any entries that are known to cascade from previous error types
        if (ruleDetails.cascadesFrom != null) {
          for (type of Array.from(ruleDetails.cascadesFrom)) {
            if (seenErrorTypes[type]) {
              entry.suppressed = true
            }
          }
        }
        // record the types of errors seen
        if (ruleDetails.types != null) {
          for (type of Array.from(ruleDetails.types)) {
            seenErrorTypes[type] = true
          }
        }

        if (ruleDetails.humanReadableHint != null) {
          entry.humanReadableHint = ruleDetails.humanReadableHint
        }
        if (ruleDetails.extraInfoURL != null) {
          entry.extraInfoURL = ruleDetails.extraInfoURL
        }
      }
    }

    // filter out the suppressed errors (from the array entries in parsedLogEntries)
    for (let key in parsedLogEntries) {
      const errors = parsedLogEntries[key]
      if (typeof errors === 'object' && errors.length > 0) {
        parsedLogEntries[key] = Array.from(errors).filter(
          err => !err.suppressed
        )
      }
    }

    return parsedLogEntries
  }
}))
