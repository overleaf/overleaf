define(function () {
  // Define some constants
  const LOG_WRAP_LIMIT = 79
  const LATEX_WARNING_REGEX = /^LaTeX Warning: (.*)$/
  const HBOX_WARNING_REGEX = /^(Over|Under)full \\(v|h)box/
  const PACKAGE_WARNING_REGEX = /^(Package \b.+\b Warning:.*)$/
  // This is used to parse the line number from common latex warnings
  const LINES_REGEX = /lines? ([0-9]+)/
  // This is used to parse the package name from the package warnings
  const PACKAGE_REGEX = /^Package (\b.+\b) Warning/

  const LogText = function (text) {
    this.text = text.replace(/(\r\n)|\r/g, '\n')
    // Join any lines which look like they have wrapped.
    const wrappedLines = this.text.split('\n')
    this.lines = [wrappedLines[0]]
    let i = 1
    while (i < wrappedLines.length) {
      // If the previous line is as long as the wrap limit then
      // append this line to it.
      // Some lines end with ... when LaTeX knows it's hit the limit
      // These shouldn't be wrapped.
      if (
        wrappedLines[i - 1].length === LOG_WRAP_LIMIT &&
        wrappedLines[i - 1].slice(-3) !== '...'
      ) {
        this.lines[this.lines.length - 1] += wrappedLines[i]
      } else {
        this.lines.push(wrappedLines[i])
      }
      i++
    }
    this.row = 0
  }

  ;(function () {
    this.nextLine = function () {
      this.row++
      if (this.row >= this.lines.length) {
        return false
      } else {
        return this.lines[this.row]
      }
    }

    this.rewindLine = function () {
      this.row--
    }

    this.linesUpToNextWhitespaceLine = function () {
      return this.linesUpToNextMatchingLine(/^ *$/)
    }

    this.linesUpToNextMatchingLine = function (match) {
      const lines = []
      let nextLine = this.nextLine()
      if (nextLine !== false) {
        lines.push(nextLine)
      }
      while (
        nextLine !== false &&
        !nextLine.match(match) &&
        nextLine !== false
      ) {
        nextLine = this.nextLine()
        if (nextLine !== false) {
          lines.push(nextLine)
        }
      }
      return lines
    }
  }.call(LogText.prototype))

  const state = {
    NORMAL: 0,
    ERROR: 1,
  }

  const LatexParser = function (text, options) {
    this.log = new LogText(text)
    this.state = state.NORMAL
    options = options || {}
    this.fileBaseNames = options.fileBaseNames || [/compiles/, /\/usr\/local/]
    this.ignoreDuplicates = options.ignoreDuplicates
    this.data = []
    this.fileStack = []
    this.currentFileList = this.rootFileList = []
    this.openParens = 0
  }

  ;(function () {
    this.parse = function () {
      while ((this.currentLine = this.log.nextLine()) !== false) {
        if (this.state === state.NORMAL) {
          if (this.currentLineIsError()) {
            this.state = state.ERROR
            this.currentError = {
              line: null,
              file: this.currentFilePath,
              level: 'error',
              message: this.currentLine.slice(2),
              content: '',
              raw: this.currentLine + '\n',
            }
          } else if (this.currentLineIsFileLineError()) {
            this.state = state.ERROR
            this.parseFileLineError()
          } else if (this.currentLineIsRunawayArgument()) {
            this.parseRunawayArgumentError()
          } else if (this.currentLineIsWarning()) {
            this.parseSingleWarningLine(LATEX_WARNING_REGEX)
          } else if (this.currentLineIsHboxWarning()) {
            this.parseHboxLine()
          } else if (this.currentLineIsPackageWarning()) {
            this.parseMultipleWarningLine()
          } else {
            this.parseParensForFilenames()
          }
        }
        if (this.state === state.ERROR) {
          this.currentError.content += this.log
            .linesUpToNextMatchingLine(/^l\.[0-9]+/)
            .join('\n')
          this.currentError.content += '\n'
          this.currentError.content += this.log
            .linesUpToNextWhitespaceLine()
            .join('\n')
          this.currentError.content += '\n'
          this.currentError.content += this.log
            .linesUpToNextWhitespaceLine()
            .join('\n')
          this.currentError.raw += this.currentError.content
          const lineNo = this.currentError.raw.match(/l\.([0-9]+)/)
          if (lineNo && this.currentError.line === null) {
            this.currentError.line = parseInt(lineNo[1], 10)
          }
          this.data.push(this.currentError)
          this.state = state.NORMAL
        }
      }
      return this.postProcess(this.data)
    }

    this.currentLineIsError = function () {
      return this.currentLine[0] === '!'
    }

    this.currentLineIsFileLineError = function () {
      return /^\/.*:\d+: .*/.test(this.currentLine)
    }

    this.currentLineIsRunawayArgument = function () {
      return this.currentLine.match(/^Runaway argument/)
    }

    this.currentLineIsWarning = function () {
      return !!this.currentLine.match(LATEX_WARNING_REGEX)
    }

    this.currentLineIsPackageWarning = function () {
      return !!this.currentLine.match(PACKAGE_WARNING_REGEX)
    }

    this.currentLineIsHboxWarning = function () {
      return !!this.currentLine.match(HBOX_WARNING_REGEX)
    }

    this.parseFileLineError = function () {
      const result = this.currentLine.match(/^(\/.*):(\d+): (.*)/)
      this.currentError = {
        line: result[2],
        file: result[1],
        level: 'error',
        message: result[3],
        content: '',
        raw: this.currentLine + '\n',
      }
    }

    this.parseRunawayArgumentError = function () {
      this.currentError = {
        line: null,
        file: this.currentFilePath,
        level: 'error',
        message: this.currentLine,
        content: '',
        raw: this.currentLine + '\n',
      }
      this.currentError.content += this.log
        .linesUpToNextWhitespaceLine()
        .join('\n')
      this.currentError.content += '\n'
      this.currentError.content += this.log
        .linesUpToNextWhitespaceLine()
        .join('\n')
      this.currentError.raw += this.currentError.content
      const lineNo = this.currentError.raw.match(/l\.([0-9]+)/)
      if (lineNo) {
        this.currentError.line = parseInt(lineNo[1], 10)
      }
      return this.data.push(this.currentError)
    }

    this.parseSingleWarningLine = function (prefix_regex) {
      const warningMatch = this.currentLine.match(prefix_regex)
      if (!warningMatch) {
        return
      }
      const warning = warningMatch[1]
      const lineMatch = warning.match(LINES_REGEX)
      const line = lineMatch ? parseInt(lineMatch[1], 10) : null
      this.data.push({
        line,
        file: this.currentFilePath,
        level: 'warning',
        message: warning,
        raw: warning,
      })
    }

    this.parseMultipleWarningLine = function () {
      // Some package warnings are multiple lines, let's parse the first line
      let warningMatch = this.currentLine.match(PACKAGE_WARNING_REGEX)
      if (!warningMatch) {
        return
      }
      // Something strange happened, return early
      const warning_lines = [warningMatch[1]]
      let lineMatch = this.currentLine.match(LINES_REGEX)
      let line = lineMatch ? parseInt(lineMatch[1], 10) : null
      const packageMatch = this.currentLine.match(PACKAGE_REGEX)
      const packageName = packageMatch[1]
      // Regex to get rid of the unnecesary (packagename) prefix in most multi-line warnings
      const prefixRegex = new RegExp(
        '(?:\\(' + packageName + '\\))*[\\s]*(.*)',
        'i'
      )
      // After every warning message there's a blank line, let's use it
      while (!!(this.currentLine = this.log.nextLine())) {
        lineMatch = this.currentLine.match(LINES_REGEX)
        line = lineMatch ? parseInt(lineMatch[1], 10) : line
        warningMatch = this.currentLine.match(prefixRegex)
        warning_lines.push(warningMatch[1])
      }
      const raw_message = warning_lines.join(' ')
      this.data.push({
        line,
        file: this.currentFilePath,
        level: 'warning',
        message: raw_message,
        raw: raw_message,
      })
    }

    this.parseHboxLine = function () {
      const lineMatch = this.currentLine.match(LINES_REGEX)
      const line = lineMatch ? parseInt(lineMatch[1], 10) : null
      this.data.push({
        line,
        file: this.currentFilePath,
        level: 'typesetting',
        message: this.currentLine,
        raw: this.currentLine,
      })
    }

    // Check if we're entering or leaving a new file in this line

    this.parseParensForFilenames = function () {
      const pos = this.currentLine.search(/\(|\)/)
      if (pos !== -1) {
        const token = this.currentLine[pos]
        this.currentLine = this.currentLine.slice(pos + 1)
        if (token === '(') {
          const filePath = this.consumeFilePath()
          if (filePath) {
            this.currentFilePath = filePath
            const newFile = {
              path: filePath,
              files: [],
            }
            this.fileStack.push(newFile)
            this.currentFileList.push(newFile)
            this.currentFileList = newFile.files
          } else {
            this.openParens++
          }
        } else if (token === ')') {
          if (this.openParens > 0) {
            this.openParens--
          } else {
            if (this.fileStack.length > 1) {
              this.fileStack.pop()
              const previousFile = this.fileStack[this.fileStack.length - 1]
              this.currentFilePath = previousFile.path
              this.currentFileList = previousFile.files
            }
          }
        }
        // else {
        //		 Something has gone wrong but all we can do now is ignore it :(
        // }
        // Process the rest of the line
        this.parseParensForFilenames()
      }
    }

    this.consumeFilePath = function () {
      // Our heuristic for detecting file names are rather crude
      // A file may not contain a space, or ) in it
      // To be a file path it must have at least one /
      if (!this.currentLine.match(/^\/?([^ \)]+\/)+/)) {
        return false
      }
      const endOfFilePath = this.currentLine.search(RegExp(' |\\)'))
      let path = undefined
      if (endOfFilePath === -1) {
        path = this.currentLine
        this.currentLine = ''
      } else {
        path = this.currentLine.slice(0, endOfFilePath)
        this.currentLine = this.currentLine.slice(endOfFilePath)
      }
      return path
    }

    this.postProcess = function (data) {
      const all = []
      const errors = []
      const warnings = []
      const typesetting = []
      const hashes = []

      const hashEntry = entry => entry.raw

      let i = 0
      while (i < data.length) {
        if (this.ignoreDuplicates && hashes.indexOf(hashEntry(data[i])) > -1) {
          i++
          continue
        }
        if (data[i].level === 'error') {
          errors.push(data[i])
        } else if (data[i].level === 'typesetting') {
          typesetting.push(data[i])
        } else if (data[i].level === 'warning') {
          warnings.push(data[i])
        }
        all.push(data[i])
        hashes.push(hashEntry(data[i]))
        i++
      }
      return {
        errors,
        warnings,
        typesetting,
        all,
        files: this.rootFileList,
      }
    }
  }.call(LatexParser.prototype))

  LatexParser.parse = (text, options) => new LatexParser(text, options).parse()

  return LatexParser
})
