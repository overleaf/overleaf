/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['./snippets/TopHundredSnippets'], function(topHundred) {
  let CommandManager
  class Parser {
    static initClass() {
      // Ignore single letter commands since auto complete is moot then.
      this.prototype.commandRegex = /\\([a-zA-Z]{2,})/
    }
    constructor(doc, prefix) {
      this.doc = doc
      this.prefix = prefix
    }

    parse() {
      // Safari regex is super slow, freezes browser for minutes on end,
      // hacky solution: limit iterations
      let command
      let limit = null
      if (
        __guard__(
          typeof window !== 'undefined' && window !== null
            ? window._ide
            : undefined,
          x => x.browserIsSafari
        )
      ) {
        limit = 5000
      }

      // fully formed commands
      const realCommands = []
      // commands which match the prefix exactly,
      // and could be partially typed or malformed
      const incidentalCommands = []
      const seen = {}
      let iterations = 0
      while ((command = this.nextCommand())) {
        iterations += 1
        if (limit && iterations > limit) {
          return realCommands
        }

        const docState = this.doc

        let optionalArgs = 0
        while (this.consumeArgument('[', ']')) {
          optionalArgs++
        }

        let args = 0
        while (this.consumeArgument('{', '}')) {
          args++
        }

        const commandHash = `${command}\\${optionalArgs}\\${args}`

        if (this.prefix != null && `\\${command}` === this.prefix) {
          incidentalCommands.push([command, optionalArgs, args])
        } else {
          if (seen[commandHash] == null) {
            seen[commandHash] = true
            realCommands.push([command, optionalArgs, args])
          }
        }

        // Reset to before argument to handle nested commands
        this.doc = docState
      }

      // check incidentals, see if we should pluck out a match
      if (incidentalCommands.length > 1) {
        const bestMatch = incidentalCommands.sort(
          (a, b) => a[1] + a[2] < b[1] + b[2]
        )[0]
        realCommands.push(bestMatch)
      }

      return realCommands
    }

    nextCommand() {
      const i = this.doc.search(this.commandRegex)
      if (i === -1) {
        return false
      } else {
        const match = this.doc.match(this.commandRegex)[1]
        this.doc = this.doc.substr(i + match.length + 1)
        return match
      }
    }

    consumeWhitespace() {
      const match = this.doc.match(/^[ \t\n]*/m)[0]
      return (this.doc = this.doc.substr(match.length))
    }

    consumeArgument(openingBracket, closingBracket) {
      this.consumeWhitespace()

      if (this.doc[0] === openingBracket) {
        let i = 1
        let bracketParity = 1
        while (bracketParity > 0 && i < this.doc.length) {
          if (this.doc[i] === openingBracket) {
            bracketParity++
          } else if (this.doc[i] === closingBracket) {
            bracketParity--
          }
          i++
        }

        if (bracketParity === 0) {
          this.doc = this.doc.substr(i)
          return true
        } else {
          return false
        }
      } else {
        return false
      }
    }
  }
  Parser.initClass()

  return (CommandManager = class CommandManager {
    constructor(metadataManager) {
      this.metadataManager = metadataManager
    }

    getCompletions(editor, session, pos, prefix, callback) {
      const commandNames = {}
      for (var snippet of Array.from(topHundred)) {
        commandNames[snippet.caption.match(/\w+/)[0]] = true
      }

      const packages = this.metadataManager.getAllPackages()
      const packageCommands = []
      for (let pkg in packages) {
        const snippets = packages[pkg]
        for (snippet of Array.from(snippets)) {
          packageCommands.push(snippet)
          commandNames[snippet.caption.match(/\w+/)[0]] = true
        }
      }

      const doc = session.getValue()
      const parser = new Parser(doc, prefix)
      const commands = parser.parse()
      let completions = []
      for (let command of Array.from(commands)) {
        if (!commandNames[command[0]]) {
          let caption = `\\${command[0]}`
          const score = caption === prefix ? 99 : 50
          snippet = caption
          var i = 1
          _.times(command[1], function() {
            snippet += `[\${${i}}]`
            caption += '[]'
            return i++
          })
          _.times(command[2], function() {
            snippet += `{\${${i}}}`
            caption += '{}'
            return i++
          })
          completions.push({
            caption,
            snippet,
            meta: 'cmd',
            score
          })
        }
      }
      completions = completions.concat(topHundred, packageCommands)

      return callback(null, completions)
    }

    loadCommandsFromDoc(doc) {
      const parser = new Parser(doc)
      return (this.commands = parser.parse())
    }

    getSuggestions(commandFragment) {
      const matchingCommands = _.filter(
        this.commands,
        command =>
          command[0].slice(0, commandFragment.length) === commandFragment
      )

      return _.map(matchingCommands, function(command) {
        let completionAfterCursor, completionBeforeCursor
        const base = `\\${commandFragment}`

        let args = ''
        _.times(command[1], () => (args = args + '[]'))
        _.times(command[2], () => (args = args + '{}'))
        const completionBase = command[0].slice(commandFragment.length)

        const squareArgsNo = command[1]
        const curlyArgsNo = command[2]
        const totalArgs = squareArgsNo + curlyArgsNo
        if (totalArgs === 0) {
          completionBeforeCursor = completionBase
          completionAfterCursor = ''
        } else {
          completionBeforeCursor = completionBase + args[0]
          completionAfterCursor = args.slice(1)
        }

        return {
          base,
          completion: completionBase + args,
          completionBeforeCursor,
          completionAfterCursor
        }
      })
    }
  })
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
