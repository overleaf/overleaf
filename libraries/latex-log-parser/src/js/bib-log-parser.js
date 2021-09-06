define(function () {
  // [fullLine, lineNumber, messageType, message]
  const LINE_SPLITTER_REGEX = /^\[(\d+)].*>\s(INFO|WARN|ERROR)\s-\s(.*)$/

  const MESSAGE_LEVELS = {
    INFO: 'info',
    WARN: 'warning',
    ERROR: 'error',
  }

  const BibLogParser = function (text, options) {
    if (typeof text !== 'string') {
      throw new Error('BibLogParser Error: text parameter must be a string')
    }
    this.text = text.replace(/(\r\n)|\r/g, '\n')
    this.options = options || {}
    this.lines = text.split('\n')
  }

  const consume = function (logText, regex, process) {
    let match
    let text = logText
    const result = []
    const re = regex
    let iterationCount = 0
    while ((match = re.exec(text))) {
      iterationCount += 1
      const newEntry = process(match)

      // Too many log entries can cause browser crashes
      // Construct a too many files error from the last match
      var maxErrors = 100
      if (iterationCount >= maxErrors) {
        var level = newEntry.level + 's'
        newEntry.message = [
          'Over',
          maxErrors,
          level,
          'returned. Download raw logs to see full list',
        ].join(' ')
        newEntry.line = undefined
        result.unshift(newEntry)
        return [result, '']
      }

      result.push(newEntry)
      text =
        match.input.slice(0, match.index) +
        match.input.slice(match.index + match[0].length + 1, match.input.length)
    }
    return [result, text]
  }

  const MULTILINE_WARNING_REGEX = /^Warning--(.+)\n--line (\d+) of file (.+)$/m
  const SINGLELINE_WARNING_REGEX = /^Warning--(.+)$/m
  const MULTILINE_ERROR_REGEX =
    /^(.*)---line (\d+) of file (.*)\n([^]+?)\nI'm skipping whatever remains of this entry$/m
  const BAD_CROSS_REFERENCE_REGEX =
    /^(A bad cross reference---entry ".+?"\nrefers to entry.+?, which doesn't exist)$/m
  const MULTILINE_COMMAND_ERROR_REGEX =
    /^(.*)\n?---line (\d+) of file (.*)\n([^]+?)\nI'm skipping whatever remains of this command$/m
  // Errors hit in BST file have a slightly different format
  const BST_ERROR_REGEX = /^(.*?)\nwhile executing---line (\d+) of file (.*)/m

  // each parser is a pair of [regex, processFunction], where processFunction
  // describes how to transform the regex mactch into a log entry object.
  const warningParsers = [
    [
      MULTILINE_WARNING_REGEX,
      function (match) {
        const [fullMatch, message, lineNumber, fileName] = match
        return {
          file: fileName,
          level: 'warning',
          message,
          line: lineNumber,
          raw: fullMatch,
        }
      },
    ],
    [
      SINGLELINE_WARNING_REGEX,
      function (match) {
        const [fullMatch, message] = match
        return {
          file: '',
          level: 'warning',
          message,
          line: '',
          raw: fullMatch,
        }
      },
    ],
  ]
  const errorParsers = [
    [
      MULTILINE_ERROR_REGEX,
      function (match) {
        const [fullMatch, firstMessage, lineNumber, fileName, secondMessage] =
          match
        return {
          file: fileName,
          level: 'error',
          message: firstMessage + '\n' + secondMessage,
          line: lineNumber,
          raw: fullMatch,
        }
      },
    ],
    [
      BAD_CROSS_REFERENCE_REGEX,
      function (match) {
        const [fullMatch, message] = match
        return {
          file: '',
          level: 'error',
          message,
          line: '',
          raw: fullMatch,
        }
      },
    ],
    [
      MULTILINE_COMMAND_ERROR_REGEX,
      function (match) {
        const [fullMatch, firstMessage, lineNumber, fileName, secondMessage] =
          match
        return {
          file: fileName,
          level: 'error',
          message: firstMessage + '\n' + secondMessage,
          line: lineNumber,
          raw: fullMatch,
        }
      },
    ],
    [
      BST_ERROR_REGEX,
      function (match) {
        var fileName, firstMessage, fullMatch, lineNumber, secondMessage
        ;(fullMatch = match[0]),
          (firstMessage = match[1]),
          (lineNumber = match[2]),
          (fileName = match[3])
        return {
          file: fileName,
          level: 'error',
          message: firstMessage,
          line: lineNumber,
          raw: fullMatch,
        }
      },
    ],
  ]

  ;(function () {
    this.parseBibtex = function () {
      let allErrors
      const result = {
        all: [],
        errors: [],
        warnings: [],
        files: [], // not used
        typesetting: [], // not used
      }
      // reduce over the parsers, starting with the log text,
      let [allWarnings, remainingText] = warningParsers.reduce(
        function (accumulator, parser) {
          const [currentWarnings, text] = accumulator
          const [regex, process] = parser
          const [warnings, _remainingText] = consume(text, regex, process)
          return [currentWarnings.concat(warnings), _remainingText]
        },
        [[], this.text]
      )
      ;[allErrors, remainingText] = errorParsers.reduce(
        function (accumulator, parser) {
          const [currentErrors, text] = accumulator
          const [regex, process] = parser
          const [errors, _remainingText] = consume(text, regex, process)
          return [currentErrors.concat(errors), _remainingText]
        },
        [[], remainingText]
      )
      result.warnings = allWarnings
      result.errors = allErrors
      result.all = allWarnings.concat(allErrors)
      return result
    }

    this.parseBiber = function () {
      const result = {
        all: [],
        errors: [],
        warnings: [],
        files: [], // not used
        typesetting: [], // not used
      }
      this.lines.forEach(function (line) {
        const match = line.match(LINE_SPLITTER_REGEX)
        if (match) {
          let [fullLine, lineNumber, messageType, message] = match
          const newEntry = {
            file: '',
            level: MESSAGE_LEVELS[messageType] || 'INFO',
            message,
            line: '',
            raw: fullLine,
          }
          // try extract file, line-number and the 'real' message from lines like:
          //   BibTeX subsystem: /.../original.bib_123.utf8, line 8, syntax error: it's bad
          const lineMatch = newEntry.message.match(
            /^BibTeX subsystem: \/.+\/(\w+\.\w+)_.+, line (\d+), (.+)$/
          )
          if (lineMatch && lineMatch.length === 4) {
            let _, fileName, realMessage
            ;[_, fileName, lineNumber, realMessage] = lineMatch
            newEntry.file = fileName
            newEntry.line = lineNumber
            newEntry.message = realMessage
          }
          result.all.push(newEntry)
          switch (newEntry.level) {
            case 'error':
              return result.errors.push(newEntry)
            case 'warning':
              return result.warnings.push(newEntry)
          }
        }
      })
      return result
    }

    return (this.parse = function () {
      const firstLine = this.lines[0]
      if (firstLine.match(/^.*INFO - This is Biber.*$/)) {
        return this.parseBiber()
      } else if (firstLine.match(/^This is BibTeX, Version.+$/)) {
        return this.parseBibtex()
      } else {
        throw new Error(
          'BibLogParser Error: cannot determine whether text is biber or bibtex output'
        )
      }
    })
  }.call(BibLogParser.prototype))

  BibLogParser.parse = (text, options) =>
    new BibLogParser(text, options).parse()

  return BibLogParser
})
