import LatexLogParser from '../log-parser/latex-log-parser'
import ruleset from './HumanReadableLogsRules'

export default {
  parse(rawLog, options) {
    const parsedLogEntries =
      typeof rawLog === 'string'
        ? new LatexLogParser(rawLog, options).parse()
        : rawLog

    const seenErrorTypes = {} // keep track of types of errors seen

    for (const entry of parsedLogEntries.all) {
      const ruleDetails = ruleset.find(rule =>
        rule.regexToMatch.test(entry.message)
      )

      if (ruleDetails) {
        if (ruleDetails.ruleId) {
          entry.ruleId = ruleDetails.ruleId
        }

        if (ruleDetails.newMessage) {
          entry.message = entry.message.replace(
            ruleDetails.regexToMatch,
            ruleDetails.newMessage
          )
        }

        if (ruleDetails.contentRegex) {
          const match = entry.content.match(ruleDetails.contentRegex)
          if (match) {
            entry.contentDetails = match.slice(1)
          }
        }

        if (entry.contentDetails && ruleDetails.improvedTitle) {
          const message = ruleDetails.improvedTitle(
            entry.message,
            entry.contentDetails
          )

          if (Array.isArray(message)) {
            entry.message = message[0]
            // removing the messageComponent, as the markup possible in it was causing crashes when
            //  attempting to broadcast it in the detach-context (cant structuredClone an html node)
            // see https://github.com/overleaf/internal/discussions/15031 for context
            // entry.messageComponent = message[1]
          } else {
            entry.message = message
          }
        }

        if (entry.contentDetails && ruleDetails.highlightCommand) {
          entry.command = ruleDetails.highlightCommand(entry.contentDetails)
        }

        // suppress any entries that are known to cascade from previous error types
        if (ruleDetails.cascadesFrom) {
          for (const type of ruleDetails.cascadesFrom) {
            if (seenErrorTypes[type]) {
              entry.suppressed = true
            }
          }
        }

        // record the types of errors seen
        if (ruleDetails.types) {
          for (const type of ruleDetails.types) {
            seenErrorTypes[type] = true
          }
        }
      }
    }

    // filter out the suppressed errors (from the array entries in parsedLogEntries)
    for (const [key, errors] of Object.entries(parsedLogEntries)) {
      if (typeof errors === 'object' && errors.length > 0) {
        parsedLogEntries[key] = Array.from(errors).filter(
          err => !err.suppressed
        )
      }
    }

    return parsedLogEntries
  },
}
