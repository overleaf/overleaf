/* eslint-disable */
/**
 * Parser.js
 * Copyright 2012-13 Mayank Lahiri
 * mlahiri@gmail.com
 * Released under the BSD License.
 *
 * Modifications 2016 Sharelatex
 * Modifications 2017-2020 Overleaf
 *
 * A forgiving Bibtex parser that can:
 *
 * (1) operate in streaming or block mode, extracting entries as dictionaries.
 * (2) convert Latex special characters to UTF-8.
 * (3) best-effort parse malformed entries.
 * (4) run in a CommonJS environment or a browser, without any dependencies.
 * (5) be advanced-compiled by Google Closure Compiler.
 *
 * Handwritten as a labor of love, not auto-generated from a grammar.
 *
 * Modes of usage:
 *
 * (1) Synchronous, string
 *
 *   var entries = BibtexParser(text);
 *   console.log(entries);
 *
 * (2) Asynchronous, stream
 *
 *   function entryCallback(entry) { console.log(entry); }
 *   var parser = new BibtexParser(entryCallback);
 *   parser.parse(chunk1);
 *   parser.parse(chunk2);
 *   ...
 *
 * @param {text|function(Object)} arg0 Either a Bibtex string or callback
 *                                    function for processing parsed entries.
 * @param {array} allowedKeys optimization: do not output key/value pairs that are not on this allowlist
 * @constructor
 */
function BibtexParser(arg0, allowedKeys) {
  // Determine how this function is to be used
  if (typeof arg0 === 'string') {
    // Passed a string, synchronous call without 'new'
    const entries = []
    function accumulator(entry) {
      entries.push(entry)
    }
    const parser = new BibtexParser(accumulator, allowedKeys)
    parser.parse(arg0)
    return {
      entries,
      errors: parser.getErrors(),
    }
  }
  if (typeof arg0 !== 'function') {
    throw 'Invalid parser construction.'
  }
  this.ALLOWEDKEYS_ = allowedKeys || []
  this.reset_(arg0)
  this.initMacros_()
  return this
}

/** @enum {number} */
BibtexParser.prototype.STATES_ = {
  ENTRY_OR_JUNK: 0,
  OBJECT_TYPE: 1,
  ENTRY_KEY: 2,
  KV_KEY: 3,
  EQUALS: 4,
  KV_VALUE: 5,
}
BibtexParser.prototype.reset_ = function (arg0) {
  /** @private */ this.DATA_ = {}
  /** @private */ this.CALLBACK_ = arg0
  /** @private */ this.CHAR_ = 0
  /** @private */ this.LINE_ = 1
  /** @private */ this.CHAR_IN_LINE_ = 0
  /** @private */ this.SKIPWS_ = true
  /** @private */ this.SKIPCOMMENT_ = true
  /** @private */ this.SKIPKVPAIR_ = false
  /** @private */ this.PARSETMP_ = {}
  /** @private */ this.SKIPTILLEOL_ = false
  /** @private */ this.VALBRACES_ = null
  /** @private */ this.BRACETYPE_ = null
  /** @private */ this.BRACECOUNT_ = 0
  /** @private */ this.STATE_ = this.STATES_.ENTRY_OR_JUNK
  /** @private */ this.ERRORS_ = []
}
/** @private */ BibtexParser.prototype.ENTRY_TYPES_ = {
  inproceedings: 1,
  proceedings: 2,
  article: 3,
  techreport: 4,
  misc: 5,
  mastersthesis: 6,
  book: 7,
  phdthesis: 8,
  incollection: 9,
  unpublished: 10,
  inbook: 11,
  manual: 12,
  periodical: 13,
  booklet: 14,
  masterthesis: 15,
  conference: 16,
  /* additional fields from biblatex */
  artwork: 17,
  audio: 18,
  bibnote: 19,
  bookinbook: 20,
  collection: 21,
  commentary: 22,
  customa: 23,
  customb: 24,
  customc: 25,
  customd: 26,
  custome: 27,
  customf: 28,
  image: 29,
  inreference: 30,
  jurisdiction: 31,
  legal: 32,
  legislation: 33,
  letter: 34,
  movie: 35,
  music: 36,
  mvbook: 37,
  mvcollection: 38,
  mvproceedings: 39,
  mvreference: 40,
  online: 41,
  patent: 42,
  performance: 43,
  reference: 44,
  report: 45,
  review: 46,
  set: 47,
  software: 48,
  standard: 49,
  suppbook: 50,
  suppcollection: 51,
  thesis: 52,
  video: 53,
}
BibtexParser.prototype.initMacros_ = function () {
  // macros can be extended by the user via
  //   @string { macroName = "macroValue" }
  /** @private */ this.MACROS_ = {
    jan: 'January',
    feb: 'February',
    mar: 'March',
    apr: 'April',
    may: 'May',
    jun: 'June',
    jul: 'July',
    aug: 'August',
    sep: 'September',
    oct: 'October',
    nov: 'November',
    dec: 'December',
    Jan: 'January',
    Feb: 'February',
    Mar: 'March',
    Apr: 'April',
    May: 'May',
    Jun: 'June',
    Jul: 'July',
    Aug: 'August',
    Sep: 'September',
    Oct: 'October',
    Nov: 'November',
    Dec: 'December',
  }
}

/**
 * Gets an array of all errors encountered during parsing.
 * Array entries are of the format:
 *  [ line number, character in line, character in stream, error text ]
 *
 * @returns Array<Array>
 * @public
 */
BibtexParser.prototype.getErrors = function () {
  return this.ERRORS_
}

/**
 * Processes a chunk of data
 * @public
 */
BibtexParser.prototype.parse = function (chunk) {
  for (let i = 0; i < chunk.length; i++) this.processCharacter_(chunk[i])
}

/**
 * Logs error at current stream position.
 *
 * @private
 */
BibtexParser.prototype.error_ = function (text) {
  this.ERRORS_.push([this.LINE_, this.CHAR_IN_LINE_, this.CHAR_, text])
}

/**
 * Called after an entire entry has been parsed from the stream.
 * Performs post-processing and invokes the entry callback pointed to by
 * this.CALLBACK_. Parsed (but unprocessed) entry data is in this.DATA_.
 */
BibtexParser.prototype.processEntry_ = function () {
  const data = this.DATA_
  if (data.Fields)
    for (const f in data.Fields) {
      let raw = data.Fields[f]

      // Convert Latex/Bibtex special characters to UTF-8 equivalents
      for (let i = 0; i < this.CHARCONV_.length; i++) {
        const re = this.CHARCONV_[i][0]
        const rep = this.CHARCONV_[i][1]
        raw = raw.replace(re, rep)
      }

      // Basic substitutions
      raw = raw
        .replace(/[\n\r\t]/g, ' ')
        .replace(/\s\s+/g, ' ')
        .replace(/^\s+|\s+$/g, '')

      // Remove braces and backslashes
      const len = raw.length
      let processedArr = []
      for (let i = 0; i < len; i++) {
        let c = raw[i]
        let skip = false
        if (c == '\\' && i < len - 1) c = raw[++i]
        else {
          if (c == '{' || c == '}') skip = true
        }
        if (!skip) processedArr.push(c)
      }
      data.Fields[f] = processedArr.join('')
      processedArr = null
    }

  if (data.ObjectType == 'string') {
    for (const f in data.Fields) {
      this.MACROS_[f] = data.Fields[f]
    }
  } else {
    // Parsed a new Bibtex entry
    this.CALLBACK_(data)
  }
}

/**
 * Processes next character in the stream, invoking the callback after
 * each entry has been found and processed.
 *
 * @private
 * @param {string} c Next character in input stream
 */
BibtexParser.prototype.processCharacter_ = function (c) {
  // Housekeeping
  this.CHAR_++
  this.CHAR_IN_LINE_++
  if (c == '\n') {
    this.LINE_++
    this.CHAR_IN_LINE_ = 1
  }

  // Convenience states for skipping whitespace when needed
  if (this.SKIPTILLEOL_) {
    if (c == '\n') this.SKIPTILLEOL_ = false
    return
  }
  if (this.SKIPCOMMENT_ && c == '%') {
    this.SKIPTILLEOL_ = true
    return
  }
  if (this.SKIPWS_ && /\s/.test(c)) return
  this.SKIPWS_ = false
  this.SKIPCOMMENT_ = false
  this.SKIPTILLEOL_ = false

  // Main state machine
  let AnotherIteration = true
  while (AnotherIteration) {
    // console.log(this.LINE_, this.CHAR_IN_LINE_, this.STATE_, c)
    AnotherIteration = false
    switch (this.STATE_) {
      // -- Scan for an object marker ('@')
      // -- Reset temporary data structure in case previous entry was garbled
      case this.STATES_.ENTRY_OR_JUNK:
        if (c == '@') {
          // SUCCESS:     Parsed a valid start-of-object marker.
          // NEXT_STATE:  OBJECT_TYPE
          this.STATE_ = this.STATES_.OBJECT_TYPE
          this.DATA_ = {
            ObjectType: '',
          }
        }
        this.BRACETYPE_ = null
        this.SKIPWS_ = true
        this.SKIPCOMMENT_ = true
        break

      // Start at first non-whitespace character after start-of-object '@'
      // -- Accept [A-Za-z], break on non-matching character
      // -- Populate this.DATA_.EntryType and this.DATA_.ObjectType
      case this.STATES_.OBJECT_TYPE:
        if (/[A-Za-z]/.test(c)) {
          this.DATA_.ObjectType += c.toLowerCase()
          this.SKIPWS_ = true
          this.SKIPCOMMENT_ = true
        } else {
          // Break from state and validate object type
          const ot = this.DATA_.ObjectType
          if (ot == 'comment') {
            this.STATE_ = this.STATES_.ENTRY_OR_JUNK
          } else {
            if (ot == 'string') {
              this.DATA_.ObjectType = ot
              this.DATA_.Fields = {}
              this.BRACETYPE_ = c
              this.BRACECOUNT_ = 1
              this.STATE_ = this.STATES_.KV_KEY
              this.SKIPWS_ = true
              this.SKIPCOMMENT_ = true
              this.PARSETMP_ = {
                Key: '',
              }
            } else {
              if (ot == 'preamble') {
                this.STATE_ = this.STATES_.ENTRY_OR_JUNK
              } else {
                if (ot in this.ENTRY_TYPES_) {
                  // SUCCESS:     Parsed a valid object type.
                  // NEXT_STATE:  ENTRY_KEY
                  this.DATA_.ObjectType = 'entry'
                  this.DATA_.EntryType = ot
                  this.DATA_.EntryKey = ''
                  this.STATE_ = this.STATES_.ENTRY_KEY
                  AnotherIteration = true
                } else {
                  // ERROR:       Unrecognized object type.
                  // NEXT_STATE:  ENTRY_OR_JUNK
                  this.error_(
                    'Unrecognized object type: "' + this.DATA_.ObjectType + '"'
                  )
                  this.STATE_ = this.STATES_.ENTRY_OR_JUNK
                }
              }
            }
          }
        }
        break

      // Start at first non-alphabetic character after an entry type
      // -- Populate this.DATA_.EntryKey
      case this.STATES_.ENTRY_KEY:
        if ((c === '{' || c === '(') && this.BRACETYPE_ == null) {
          this.BRACETYPE_ = c
          this.BRACECOUNT_ = 1
          this.SKIPWS_ = true
          this.SKIPCOMMENT_ = true
          break
        }
        if (/[,%\s]/.test(c)) {
          if (this.DATA_.EntryKey.length < 1) {
            // Skip comments and whitespace before entry key
            this.SKIPWS_ = true
            this.SKIPCOMMENT_ = true
          } else {
            if (this.BRACETYPE_ == null) {
              // ERROR:       No opening brace for object
              // NEXT_STATE:  ENTRY_OR_JUNK
              this.error_('No opening brace for object.')
              this.STATE_ = this.STATES_.ENTRY_OR_JUNK
            } else {
              // SUCCESS:     Parsed an entry key
              // NEXT_STATE:  KV_KEY
              this.SKIPWS_ = true
              this.SKIPCOMMENT_ = true
              AnotherIteration = true
              this.STATE_ = this.STATES_.KV_KEY
              this.PARSETMP_.Key = ''
              this.DATA_.Fields = {}
            }
          }
        } else {
          this.DATA_.EntryKey += c
          this.SKIPWS_ = false
          this.SKIPCOMMENT_ = false
        }
        break

      // Start at first non-whitespace/comment character after entry key.
      // -- Populate this.PARSETMP_.Key
      case this.STATES_.KV_KEY:
        // Test for end of entry
        if (
          (c == '}' && this.BRACETYPE_ == '{') ||
          (c == ')' && this.BRACETYPE_ == '(')
        ) {
          // SUCCESS:       Parsed an entry, possible incomplete
          // NEXT_STATE:    ENTRY_OR_JUNK
          this.processEntry_()
          this.SKIPWS_ = true
          this.SKIPCOMMENT_ = true
          this.STATE_ = this.STATES_.ENTRY_OR_JUNK
          break
        }
        if (/[\-A-Za-z:]/.test(c)) {
          // Add to key
          this.PARSETMP_.Key += c
          this.SKIPWS_ = false
          this.SKIPCOMMENT_ = false
        } else {
          // Either end of key or we haven't encountered start of key
          if (this.PARSETMP_.Key.length < 1) {
            // Keep going till we see a key
            this.SKIPWS_ = true
            this.SKIPCOMMENT_ = true
          } else {
            // SUCCESS:       Found full key in K/V pair
            // NEXT_STATE:    EQUALS
            this.SKIPWS_ = true
            this.SKIPCOMMENT_ = true
            this.STATE_ = this.STATES_.EQUALS
            AnotherIteration = true

            if (this.DATA_.ObjectType !== 'string') {
              // this entry is not a macro
              // normalize the key to lower case
              this.PARSETMP_.Key = this.PARSETMP_.Key.toLowerCase()

              // optimization: skip key/value pairs that are not on the allowlist
              this.SKIPKVPAIR_ =
                // has allowedKeys set
                this.ALLOWEDKEYS_.length &&
                // key is not on the allowlist
                this.ALLOWEDKEYS_.indexOf(this.PARSETMP_.Key) === -1
            } else {
              this.SKIPKVPAIR_ = false
            }
          }
        }
        break

      // Start at first non-alphabetic character after K/V pair key.
      case this.STATES_.EQUALS:
        if (
          (c == '}' && this.BRACETYPE_ == '{') ||
          (c == ')' && this.BRACETYPE_ == '(')
        ) {
          // ERROR:         K/V pair with key but no value
          // NEXT_STATE:    ENTRY_OR_JUNK
          this.error_(
            'Key-value pair has key "' + this.PARSETMP_.Key + '", but no value.'
          )
          this.processEntry_()
          this.SKIPWS_ = true
          this.SKIPCOMMENT_ = true
          this.STATE_ = this.STATES_.ENTRY_OR_JUNK
          break
        }
        if (c == '=') {
          // SUCCESS:       found an equal signs separating key and value
          // NEXT_STATE:    KV_VALUE
          this.SKIPWS_ = true
          this.SKIPCOMMENT_ = true
          this.STATE_ = this.STATES_.KV_VALUE
          this.PARSETMP_.Value = []
          this.VALBRACES_ = { '"': [], '{': [] }
        }
        break

      // Start at first non-whitespace/comment character after '='
      // -- Populate this.PARSETMP_.Value
      case this.STATES_.KV_VALUE:
        const delim = this.VALBRACES_
        // valueCharsArray is the list of characters that make up the
        // current value
        const valueCharsArray = this.PARSETMP_.Value
        let doneParsingValue = false

        // Test for special characters
        if (c == '"' || c == '{' || c == '}' || c == ',') {
          if (c == ',') {
            // This comma can mean:
            // (1) just another comma literal
            // (2) end of a macro reference
            if (delim['"'].length + delim['{'].length === 0) {
              // end of a macro reference
              const macro = this.PARSETMP_.Value.join('').trim()
              if (macro in this.MACROS_) {
                // Successful macro reference
                this.PARSETMP_.Value = [this.MACROS_[macro]]
              } else {
                // Reference to an undefined macro
                this.error_('Reference to an undefined macro: ' + macro)
              }
              doneParsingValue = true
            }
          }
          if (c == '"') {
            // This quote can mean:
            // (1) opening delimiter
            // (2) closing delimiter
            // (3) literal, if we have a '{' on the stack
            if (delim['"'].length + delim['{'].length === 0) {
              // opening delimiter
              delim['"'].push(this.CHAR_)
              this.SKIPWS_ = false
              this.SKIPCOMMENT_ = false
              break
            }
            if (
              delim['"'].length == 1 &&
              delim['{'].length == 0 &&
              (valueCharsArray.length == 0 ||
                valueCharsArray[valueCharsArray.length - 1] != '\\')
            ) {
              // closing delimiter
              doneParsingValue = true
            } else {
              // literal, add to value
            }
          }
          if (c == '{') {
            // This brace can mean:
            // (1) opening delimiter
            // (2) stacked verbatim delimiter
            if (
              valueCharsArray.length == 0 ||
              valueCharsArray[valueCharsArray.length - 1] != '\\'
            ) {
              delim['{'].push(this.CHAR_)
              this.SKIPWS_ = false
              this.SKIPCOMMENT_ = false
            } else {
              // literal, add to value
            }
          }
          if (c == '}') {
            // This brace can mean:
            // (1) closing delimiter
            // (2) closing stacked verbatim delimiter
            // (3) end of object definition if value was a macro
            if (delim['"'].length + delim['{'].length === 0) {
              // end of object definition, after macro
              const macro = this.PARSETMP_.Value.join('').trim()
              if (macro in this.MACROS_) {
                // Successful macro reference
                this.PARSETMP_.Value = [this.MACROS_[macro]]
              } else {
                // Reference to an undefined macro
                this.error_('Reference to an undefined macro: ' + macro)
              }
              AnotherIteration = true
              doneParsingValue = true
            } else {
              // sometimes imported bibs will have {\},{\\}, {\\\}, {\\\\}, etc for whitespace,
              //  which would otherwise break the parsing. we watch for these occurences of
              //  1+ backslashes in an empty bracket pair to gracefully handle the malformed bib file
              const doubleSlash =
                valueCharsArray.length >= 2 &&
                valueCharsArray[valueCharsArray.length - 1] === '\\' && // for \\}
                valueCharsArray[valueCharsArray.length - 2] === '\\'
              const singleSlash =
                valueCharsArray.length >= 2 &&
                valueCharsArray[valueCharsArray.length - 1] === '\\' && // for {\}
                valueCharsArray[valueCharsArray.length - 2] === '{'

              if (
                valueCharsArray.length == 0 ||
                valueCharsArray[valueCharsArray.length - 1] != '\\' || // for }
                doubleSlash ||
                singleSlash
              ) {
                if (delim['{'].length > 0) {
                  // pop stack for stacked verbatim delimiter
                  delim['{'].splice(delim['{'].length - 1, 1)
                  if (delim['{'].length + delim['"'].length == 0) {
                    // closing delimiter
                    doneParsingValue = true
                  } else {
                    // end verbatim block
                  }
                }
              } else {
                // literal, add to value
              }
            }
          }
        }

        // If here, then we are either done parsing the value or
        // have a literal that should be added to the value.
        if (doneParsingValue) {
          // SUCCESS:     value parsed
          // NEXT_STATE:  KV_KEY
          this.SKIPWS_ = true
          this.SKIPCOMMENT_ = true
          this.STATE_ = this.STATES_.KV_KEY
          if (!this.SKIPKVPAIR_) {
            this.DATA_.Fields[this.PARSETMP_.Key] =
              this.PARSETMP_.Value.join('')
          }
          this.PARSETMP_ = { Key: '' }
          this.VALBRACES_ = null
        } else {
          this.PARSETMP_.Value.push(c)
          if (this.PARSETMP_.Value.length >= 1000 * 20) {
            this.PARSETMP_.Value = []
            this.STATE_ = this.STATES_.ENTRY_OR_JUNK
            this.DATA_ = { ObjectType: '' }
            this.BRACETYPE_ = null
            this.SKIPWS_ = true
            this.SKIPCOMMENT_ = true
          }
        }
        break
    } // end switch (this.STATE_)
  } // end while(AnotherIteration)
} // end function processCharacter

/** @private */ BibtexParser.prototype.CHARCONV_ = [
  [/\\space /g, '\u0020'],
  [/\\textdollar /g, '\u0024'],
  [/\\textquotesingle /g, '\u0027'],
  [/\\ast /g, '\u002A'],
  [/\\textbackslash /g, '\u005C'],
  [/\\\^\{\}/g, '\u005E'],
  [/\\textasciigrave /g, '\u0060'],
  [/\\lbrace /g, '\u007B'],
  [/\\vert /g, '\u007C'],
  [/\\rbrace /g, '\u007D'],
  [/\\textasciitilde /g, '\u007E'],
  [/\\textexclamdown /g, '\u00A1'],
  [/\\textcent /g, '\u00A2'],
  [/\\textsterling /g, '\u00A3'],
  [/\\textcurrency /g, '\u00A4'],
  [/\\textyen /g, '\u00A5'],
  [/\\textbrokenbar /g, '\u00A6'],
  [/\\textsection /g, '\u00A7'],
  [/\\textasciidieresis /g, '\u00A8'],
  [/\\textcopyright /g, '\u00A9'],
  [/\\textordfeminine /g, '\u00AA'],
  [/\\guillemotleft /g, '\u00AB'],
  [/\\lnot /g, '\u00AC'],
  [/\\textregistered /g, '\u00AE'],
  [/\\textasciimacron /g, '\u00AF'],
  [/\\textdegree /g, '\u00B0'],
  [/\\pm /g, '\u00B1'],
  [/\\textasciiacute /g, '\u00B4'],
  [/\\mathrm\{\\mu\}/g, '\u00B5'],
  [/\\textparagraph /g, '\u00B6'],
  [/\\cdot /g, '\u00B7'],
  [/\\c\{\}/g, '\u00B8'],
  [/\\textordmasculine /g, '\u00BA'],
  [/\\guillemotright /g, '\u00BB'],
  [/\\textonequarter /g, '\u00BC'],
  [/\\textonehalf /g, '\u00BD'],
  [/\\textthreequarters /g, '\u00BE'],
  [/\\textquestiondown /g, '\u00BF'],
  [/\\`\{A\}/g, '\u00C0'],
  [/\\'\{A\}/g, '\u00C1'],
  [/\\\^\{A\}/g, '\u00C2'],
  [/\\~\{A\}/g, '\u00C3'],
  [/\\"\{A\}/g, '\u00C4'],
  [/\\AA /g, '\u00C5'],
  [/\\AE /g, '\u00C6'],
  [/\\c\{C\}/g, '\u00C7'],
  [/\\`\{E\}/g, '\u00C8'],
  [/\\'\{E\}/g, '\u00C9'],
  [/\\\^\{E\}/g, '\u00CA'],
  [/\\"\{E\}/g, '\u00CB'],
  [/\\`\{I\}/g, '\u00CC'],
  [/\\'\{I\}/g, '\u00CD'],
  [/\\\^\{I\}/g, '\u00CE'],
  [/\\"\{I\}/g, '\u00CF'],
  [/\\DH /g, '\u00D0'],
  [/\\~\{N\}/g, '\u00D1'],
  [/\\`\{O\}/g, '\u00D2'],
  [/\\'\{O\}/g, '\u00D3'],
  [/\\\^\{O\}/g, '\u00D4'],
  [/\\~\{O\}/g, '\u00D5'],
  [/\\"\{O\}/g, '\u00D6'],
  [/\\texttimes /g, '\u00D7'],
  [/\\O /g, '\u00D8'],
  [/\\`\{U\}/g, '\u00D9'],
  [/\\'\{U\}/g, '\u00DA'],
  [/\\\^\{U\}/g, '\u00DB'],
  [/\\"\{U\}/g, '\u00DC'],
  [/\\'\{Y\}/g, '\u00DD'],
  [/\\TH /g, '\u00DE'],
  [/\\ss /g, '\u00DF'],
  [/\\`\{a\}/g, '\u00E0'],
  [/\\'\{a\}/g, '\u00E1'],
  [/\\\^\{a\}/g, '\u00E2'],
  [/\\~\{a\}/g, '\u00E3'],
  [/\\"\{a\}/g, '\u00E4'],
  [/\\aa /g, '\u00E5'],
  [/\\ae /g, '\u00E6'],
  [/\\c\{c\}/g, '\u00E7'],
  [/\\`\{e\}/g, '\u00E8'],
  [/\\'\{e\}/g, '\u00E9'],
  [/\\\^\{e\}/g, '\u00EA'],
  [/\\"\{e\}/g, '\u00EB'],
  [/\\`\{\\i\}/g, '\u00EC'],
  [/\\'\{\\i\}/g, '\u00ED'],
  [/\\\^\{\\i\}/g, '\u00EE'],
  [/\\"\{\\i\}/g, '\u00EF'],
  [/\\dh /g, '\u00F0'],
  [/\\~\{n\}/g, '\u00F1'],
  [/\\`\{o\}/g, '\u00F2'],
  [/\\'\{o\}/g, '\u00F3'],
  [/\\\^\{o\}/g, '\u00F4'],
  [/\\~\{o\}/g, '\u00F5'],
  [/\\"\{o\}/g, '\u00F6'],
  [/\\div /g, '\u00F7'],
  [/\\o /g, '\u00F8'],
  [/\\`\{u\}/g, '\u00F9'],
  [/\\'\{u\}/g, '\u00FA'],
  [/\\\^\{u\}/g, '\u00FB'],
  [/\\"\{u\}/g, '\u00FC'],
  [/\\'\{y\}/g, '\u00FD'],
  [/\\th /g, '\u00FE'],
  [/\\"\{y\}/g, '\u00FF'],
  [/\\=\{A\}/g, '\u0100'],
  [/\\=\{a\}/g, '\u0101'],
  [/\\u\{A\}/g, '\u0102'],
  [/\\u\{a\}/g, '\u0103'],
  [/\\k\{A\}/g, '\u0104'],
  [/\\k\{a\}/g, '\u0105'],
  [/\\'\{C\}/g, '\u0106'],
  [/\\'\{c\}/g, '\u0107'],
  [/\\\^\{C\}/g, '\u0108'],
  [/\\\^\{c\}/g, '\u0109'],
  [/\\.\{C\}/g, '\u010A'],
  [/\\.\{c\}/g, '\u010B'],
  [/\\v\{C\}/g, '\u010C'],
  [/\\v\{c\}/g, '\u010D'],
  [/\\v\{D\}/g, '\u010E'],
  [/\\v\{d\}/g, '\u010F'],
  [/\\DJ /g, '\u0110'],
  [/\\dj /g, '\u0111'],
  [/\\=\{E\}/g, '\u0112'],
  [/\\=\{e\}/g, '\u0113'],
  [/\\u\{E\}/g, '\u0114'],
  [/\\u\{e\}/g, '\u0115'],
  [/\\.\{E\}/g, '\u0116'],
  [/\\.\{e\}/g, '\u0117'],
  [/\\k\{E\}/g, '\u0118'],
  [/\\k\{e\}/g, '\u0119'],
  [/\\v\{E\}/g, '\u011A'],
  [/\\v\{e\}/g, '\u011B'],
  [/\\\^\{G\}/g, '\u011C'],
  [/\\\^\{g\}/g, '\u011D'],
  [/\\u\{G\}/g, '\u011E'],
  [/\\u\{g\}/g, '\u011F'],
  [/\\.\{G\}/g, '\u0120'],
  [/\\.\{g\}/g, '\u0121'],
  [/\\c\{G\}/g, '\u0122'],
  [/\\c\{g\}/g, '\u0123'],
  [/\\\^\{H\}/g, '\u0124'],
  [/\\\^\{h\}/g, '\u0125'],
  [/\\Elzxh /g, '\u0127'],
  [/\\~\{I\}/g, '\u0128'],
  [/\\~\{\\i\}/g, '\u0129'],
  [/\\=\{I\}/g, '\u012A'],
  [/\\=\{\\i\}/g, '\u012B'],
  [/\\u\{I\}/g, '\u012C'],
  [/\\u\{\\i\}/g, '\u012D'],
  [/\\k\{I\}/g, '\u012E'],
  [/\\k\{i\}/g, '\u012F'],
  [/\\.\{I\}/g, '\u0130'],
  [/\\i /g, '\u0131'],
  [/\\\^\{J\}/g, '\u0134'],
  [/\\\^\{\\j\}/g, '\u0135'],
  [/\\c\{K\}/g, '\u0136'],
  [/\\c\{k\}/g, '\u0137'],
  [/\\'\{L\}/g, '\u0139'],
  [/\\'\{l\}/g, '\u013A'],
  [/\\c\{L\}/g, '\u013B'],
  [/\\c\{l\}/g, '\u013C'],
  [/\\v\{L\}/g, '\u013D'],
  [/\\v\{l\}/g, '\u013E'],
  [/\\L /g, '\u0141'],
  [/\\l /g, '\u0142'],
  [/\\'\{N\}/g, '\u0143'],
  [/\\'\{n\}/g, '\u0144'],
  [/\\c\{N\}/g, '\u0145'],
  [/\\c\{n\}/g, '\u0146'],
  [/\\v\{N\}/g, '\u0147'],
  [/\\v\{n\}/g, '\u0148'],
  [/\\NG /g, '\u014A'],
  [/\\ng /g, '\u014B'],
  [/\\=\{O\}/g, '\u014C'],
  [/\\=\{o\}/g, '\u014D'],
  [/\\u\{O\}/g, '\u014E'],
  [/\\u\{o\}/g, '\u014F'],
  [/\\H\{O\}/g, '\u0150'],
  [/\\H\{o\}/g, '\u0151'],
  [/\\OE /g, '\u0152'],
  [/\\oe /g, '\u0153'],
  [/\\'\{R\}/g, '\u0154'],
  [/\\'\{r\}/g, '\u0155'],
  [/\\c\{R\}/g, '\u0156'],
  [/\\c\{r\}/g, '\u0157'],
  [/\\v\{R\}/g, '\u0158'],
  [/\\v\{r\}/g, '\u0159'],
  [/\\'\{S\}/g, '\u015A'],
  [/\\'\{s\}/g, '\u015B'],
  [/\\\^\{S\}/g, '\u015C'],
  [/\\\^\{s\}/g, '\u015D'],
  [/\\c\{S\}/g, '\u015E'],
  [/\\c\{s\}/g, '\u015F'],
  [/\\v\{S\}/g, '\u0160'],
  [/\\v\{s\}/g, '\u0161'],
  [/\\c\{T\}/g, '\u0162'],
  [/\\c\{t\}/g, '\u0163'],
  [/\\v\{T\}/g, '\u0164'],
  [/\\v\{t\}/g, '\u0165'],
  [/\\~\{U\}/g, '\u0168'],
  [/\\~\{u\}/g, '\u0169'],
  [/\\=\{U\}/g, '\u016A'],
  [/\\=\{u\}/g, '\u016B'],
  [/\\u\{U\}/g, '\u016C'],
  [/\\u\{u\}/g, '\u016D'],
  [/\\r\{U\}/g, '\u016E'],
  [/\\r\{u\}/g, '\u016F'],
  [/\\H\{U\}/g, '\u0170'],
  [/\\H\{u\}/g, '\u0171'],
  [/\\k\{U\}/g, '\u0172'],
  [/\\k\{u\}/g, '\u0173'],
  [/\\\^\{W\}/g, '\u0174'],
  [/\\\^\{w\}/g, '\u0175'],
  [/\\\^\{Y\}/g, '\u0176'],
  [/\\\^\{y\}/g, '\u0177'],
  [/\\"\{Y\}/g, '\u0178'],
  [/\\'\{Z\}/g, '\u0179'],
  [/\\'\{z\}/g, '\u017A'],
  [/\\.\{Z\}/g, '\u017B'],
  [/\\.\{z\}/g, '\u017C'],
  [/\\v\{Z\}/g, '\u017D'],
  [/\\v\{z\}/g, '\u017E'],
  [/\\texthvlig /g, '\u0195'],
  [/\\textnrleg /g, '\u019E'],
  [/\\eth /g, '\u01AA'],
  [/\\textdoublepipe /g, '\u01C2'],
  [/\\'\{g\}/g, '\u01F5'],
  [/\\Elztrna /g, '\u0250'],
  [/\\Elztrnsa /g, '\u0252'],
  [/\\Elzopeno /g, '\u0254'],
  [/\\Elzrtld /g, '\u0256'],
  [/\\Elzschwa /g, '\u0259'],
  [/\\varepsilon /g, '\u025B'],
  [/\\Elzpgamma /g, '\u0263'],
  [/\\Elzpbgam /g, '\u0264'],
  [/\\Elztrnh /g, '\u0265'],
  [/\\Elzbtdl /g, '\u026C'],
  [/\\Elzrtll /g, '\u026D'],
  [/\\Elztrnm /g, '\u026F'],
  [/\\Elztrnmlr /g, '\u0270'],
  [/\\Elzltlmr /g, '\u0271'],
  [/\\Elzltln /g, '\u0272'],
  [/\\Elzrtln /g, '\u0273'],
  [/\\Elzclomeg /g, '\u0277'],
  [/\\textphi /g, '\u0278'],
  [/\\Elztrnr /g, '\u0279'],
  [/\\Elztrnrl /g, '\u027A'],
  [/\\Elzrttrnr /g, '\u027B'],
  [/\\Elzrl /g, '\u027C'],
  [/\\Elzrtlr /g, '\u027D'],
  [/\\Elzfhr /g, '\u027E'],
  [/\\Elzrtls /g, '\u0282'],
  [/\\Elzesh /g, '\u0283'],
  [/\\Elztrnt /g, '\u0287'],
  [/\\Elzrtlt /g, '\u0288'],
  [/\\Elzpupsil /g, '\u028A'],
  [/\\Elzpscrv /g, '\u028B'],
  [/\\Elzinvv /g, '\u028C'],
  [/\\Elzinvw /g, '\u028D'],
  [/\\Elztrny /g, '\u028E'],
  [/\\Elzrtlz /g, '\u0290'],
  [/\\Elzyogh /g, '\u0292'],
  [/\\Elzglst /g, '\u0294'],
  [/\\Elzreglst /g, '\u0295'],
  [/\\Elzinglst /g, '\u0296'],
  [/\\textturnk /g, '\u029E'],
  [/\\Elzdyogh /g, '\u02A4'],
  [/\\Elztesh /g, '\u02A7'],
  [/\\textasciicaron /g, '\u02C7'],
  [/\\Elzverts /g, '\u02C8'],
  [/\\Elzverti /g, '\u02CC'],
  [/\\Elzlmrk /g, '\u02D0'],
  [/\\Elzhlmrk /g, '\u02D1'],
  [/\\Elzsbrhr /g, '\u02D2'],
  [/\\Elzsblhr /g, '\u02D3'],
  [/\\Elzrais /g, '\u02D4'],
  [/\\Elzlow /g, '\u02D5'],
  [/\\textasciibreve /g, '\u02D8'],
  [/\\textperiodcentered /g, '\u02D9'],
  [/\\r\{\}/g, '\u02DA'],
  [/\\k\{\}/g, '\u02DB'],
  [/\\texttildelow /g, '\u02DC'],
  [/\\H\{\}/g, '\u02DD'],
  [/\\tone\{55\}/g, '\u02E5'],
  [/\\tone\{44\}/g, '\u02E6'],
  [/\\tone\{33\}/g, '\u02E7'],
  [/\\tone\{22\}/g, '\u02E8'],
  [/\\tone\{11\}/g, '\u02E9'],
  [/\\cyrchar\\C/g, '\u030F'],
  [/\\Elzpalh /g, '\u0321'],
  [/\\Elzrh /g, '\u0322'],
  [/\\Elzsbbrg /g, '\u032A'],
  [/\\Elzxl /g, '\u0335'],
  [/\\Elzbar /g, '\u0336'],
  [/\\'\{A\}/g, '\u0386'],
  [/\\'\{E\}/g, '\u0388'],
  [/\\'\{H\}/g, '\u0389'],
  [/\\'\{\}\{I\}/g, '\u038A'],
  [/\\'\{\}O/g, '\u038C'],
  [/\\mathrm\{'Y\}/g, '\u038E'],
  [/\\mathrm\{'\\Omega\}/g, '\u038F'],
  [/\\acute\{\\ddot\{\\iota\}\}/g, '\u0390'],
  [/\\Alpha /g, '\u0391'],
  [/\\Beta /g, '\u0392'],
  [/\\Gamma /g, '\u0393'],
  [/\\Delta /g, '\u0394'],
  [/\\Epsilon /g, '\u0395'],
  [/\\Zeta /g, '\u0396'],
  [/\\Eta /g, '\u0397'],
  [/\\Theta /g, '\u0398'],
  [/\\Iota /g, '\u0399'],
  [/\\Kappa /g, '\u039A'],
  [/\\Lambda /g, '\u039B'],
  [/\\Xi /g, '\u039E'],
  [/\\Pi /g, '\u03A0'],
  [/\\Rho /g, '\u03A1'],
  [/\\Sigma /g, '\u03A3'],
  [/\\Tau /g, '\u03A4'],
  [/\\Upsilon /g, '\u03A5'],
  [/\\Phi /g, '\u03A6'],
  [/\\Chi /g, '\u03A7'],
  [/\\Psi /g, '\u03A8'],
  [/\\Omega /g, '\u03A9'],
  [/\\mathrm\{\\ddot\{I\}\}/g, '\u03AA'],
  [/\\mathrm\{\\ddot\{Y\}\}/g, '\u03AB'],
  [/\\'\{\$\\alpha\$\}/g, '\u03AC'],
  [/\\acute\{\\epsilon\}/g, '\u03AD'],
  [/\\acute\{\\eta\}/g, '\u03AE'],
  [/\\acute\{\\iota\}/g, '\u03AF'],
  [/\\acute\{\\ddot\{\\upsilon\}\}/g, '\u03B0'],
  [/\\alpha /g, '\u03B1'],
  [/\\beta /g, '\u03B2'],
  [/\\gamma /g, '\u03B3'],
  [/\\delta /g, '\u03B4'],
  [/\\epsilon /g, '\u03B5'],
  [/\\zeta /g, '\u03B6'],
  [/\\eta /g, '\u03B7'],
  [/\\texttheta /g, '\u03B8'],
  [/\\iota /g, '\u03B9'],
  [/\\kappa /g, '\u03BA'],
  [/\\lambda /g, '\u03BB'],
  [/\\mu /g, '\u03BC'],
  [/\\nu /g, '\u03BD'],
  [/\\xi /g, '\u03BE'],
  [/\\pi /g, '\u03C0'],
  [/\\rho /g, '\u03C1'],
  [/\\varsigma /g, '\u03C2'],
  [/\\sigma /g, '\u03C3'],
  [/\\tau /g, '\u03C4'],
  [/\\upsilon /g, '\u03C5'],
  [/\\varphi /g, '\u03C6'],
  [/\\chi /g, '\u03C7'],
  [/\\psi /g, '\u03C8'],
  [/\\omega /g, '\u03C9'],
  [/\\ddot\{\\iota\}/g, '\u03CA'],
  [/\\ddot\{\\upsilon\}/g, '\u03CB'],
  [/\\'\{o\}/g, '\u03CC'],
  [/\\acute\{\\upsilon\}/g, '\u03CD'],
  [/\\acute\{\\omega\}/g, '\u03CE'],
  [/\\Pisymbol\{ppi022\}\{87\}/g, '\u03D0'],
  [/\\textvartheta /g, '\u03D1'],
  [/\\Upsilon /g, '\u03D2'],
  [/\\phi /g, '\u03D5'],
  [/\\varpi /g, '\u03D6'],
  [/\\Stigma /g, '\u03DA'],
  [/\\Digamma /g, '\u03DC'],
  [/\\digamma /g, '\u03DD'],
  [/\\Koppa /g, '\u03DE'],
  [/\\Sampi /g, '\u03E0'],
  [/\\varkappa /g, '\u03F0'],
  [/\\varrho /g, '\u03F1'],
  [/\\textTheta /g, '\u03F4'],
  [/\\backepsilon /g, '\u03F6'],
  [/\\cyrchar\\CYRYO /g, '\u0401'],
  [/\\cyrchar\\CYRDJE /g, '\u0402'],
  [/\\cyrchar\{\\'\\CYRG\}/g, '\u0403'],
  [/\\cyrchar\\CYRIE /g, '\u0404'],
  [/\\cyrchar\\CYRDZE /g, '\u0405'],
  [/\\cyrchar\\CYRII /g, '\u0406'],
  [/\\cyrchar\\CYRYI /g, '\u0407'],
  [/\\cyrchar\\CYRJE /g, '\u0408'],
  [/\\cyrchar\\CYRLJE /g, '\u0409'],
  [/\\cyrchar\\CYRNJE /g, '\u040A'],
  [/\\cyrchar\\CYRTSHE /g, '\u040B'],
  [/\\cyrchar\{\\'\\CYRK\}/g, '\u040C'],
  [/\\cyrchar\\CYRUSHRT /g, '\u040E'],
  [/\\cyrchar\\CYRDZHE /g, '\u040F'],
  [/\\cyrchar\\CYRA /g, '\u0410'],
  [/\\cyrchar\\CYRB /g, '\u0411'],
  [/\\cyrchar\\CYRV /g, '\u0412'],
  [/\\cyrchar\\CYRG /g, '\u0413'],
  [/\\cyrchar\\CYRD /g, '\u0414'],
  [/\\cyrchar\\CYRE /g, '\u0415'],
  [/\\cyrchar\\CYRZH /g, '\u0416'],
  [/\\cyrchar\\CYRZ /g, '\u0417'],
  [/\\cyrchar\\CYRI /g, '\u0418'],
  [/\\cyrchar\\CYRISHRT /g, '\u0419'],
  [/\\cyrchar\\CYRK /g, '\u041A'],
  [/\\cyrchar\\CYRL /g, '\u041B'],
  [/\\cyrchar\\CYRM /g, '\u041C'],
  [/\\cyrchar\\CYRN /g, '\u041D'],
  [/\\cyrchar\\CYRO /g, '\u041E'],
  [/\\cyrchar\\CYRP /g, '\u041F'],
  [/\\cyrchar\\CYRR /g, '\u0420'],
  [/\\cyrchar\\CYRS /g, '\u0421'],
  [/\\cyrchar\\CYRT /g, '\u0422'],
  [/\\cyrchar\\CYRU /g, '\u0423'],
  [/\\cyrchar\\CYRF /g, '\u0424'],
  [/\\cyrchar\\CYRH /g, '\u0425'],
  [/\\cyrchar\\CYRC /g, '\u0426'],
  [/\\cyrchar\\CYRCH /g, '\u0427'],
  [/\\cyrchar\\CYRSH /g, '\u0428'],
  [/\\cyrchar\\CYRSHCH /g, '\u0429'],
  [/\\cyrchar\\CYRHRDSN /g, '\u042A'],
  [/\\cyrchar\\CYRERY /g, '\u042B'],
  [/\\cyrchar\\CYRSFTSN /g, '\u042C'],
  [/\\cyrchar\\CYREREV /g, '\u042D'],
  [/\\cyrchar\\CYRYU /g, '\u042E'],
  [/\\cyrchar\\CYRYA /g, '\u042F'],
  [/\\cyrchar\\cyra /g, '\u0430'],
  [/\\cyrchar\\cyrb /g, '\u0431'],
  [/\\cyrchar\\cyrv /g, '\u0432'],
  [/\\cyrchar\\cyrg /g, '\u0433'],
  [/\\cyrchar\\cyrd /g, '\u0434'],
  [/\\cyrchar\\cyre /g, '\u0435'],
  [/\\cyrchar\\cyrzh /g, '\u0436'],
  [/\\cyrchar\\cyrz /g, '\u0437'],
  [/\\cyrchar\\cyri /g, '\u0438'],
  [/\\cyrchar\\cyrishrt /g, '\u0439'],
  [/\\cyrchar\\cyrk /g, '\u043A'],
  [/\\cyrchar\\cyrl /g, '\u043B'],
  [/\\cyrchar\\cyrm /g, '\u043C'],
  [/\\cyrchar\\cyrn /g, '\u043D'],
  [/\\cyrchar\\cyro /g, '\u043E'],
  [/\\cyrchar\\cyrp /g, '\u043F'],
  [/\\cyrchar\\cyrr /g, '\u0440'],
  [/\\cyrchar\\cyrs /g, '\u0441'],
  [/\\cyrchar\\cyrt /g, '\u0442'],
  [/\\cyrchar\\cyru /g, '\u0443'],
  [/\\cyrchar\\cyrf /g, '\u0444'],
  [/\\cyrchar\\cyrh /g, '\u0445'],
  [/\\cyrchar\\cyrc /g, '\u0446'],
  [/\\cyrchar\\cyrch /g, '\u0447'],
  [/\\cyrchar\\cyrsh /g, '\u0448'],
  [/\\cyrchar\\cyrshch /g, '\u0449'],
  [/\\cyrchar\\cyrhrdsn /g, '\u044A'],
  [/\\cyrchar\\cyrery /g, '\u044B'],
  [/\\cyrchar\\cyrsftsn /g, '\u044C'],
  [/\\cyrchar\\cyrerev /g, '\u044D'],
  [/\\cyrchar\\cyryu /g, '\u044E'],
  [/\\cyrchar\\cyrya /g, '\u044F'],
  [/\\cyrchar\\cyryo /g, '\u0451'],
  [/\\cyrchar\\cyrdje /g, '\u0452'],
  [/\\cyrchar\{\\'\\cyrg\}/g, '\u0453'],
  [/\\cyrchar\\cyrie /g, '\u0454'],
  [/\\cyrchar\\cyrdze /g, '\u0455'],
  [/\\cyrchar\\cyrii /g, '\u0456'],
  [/\\cyrchar\\cyryi /g, '\u0457'],
  [/\\cyrchar\\cyrje /g, '\u0458'],
  [/\\cyrchar\\cyrlje /g, '\u0459'],
  [/\\cyrchar\\cyrnje /g, '\u045A'],
  [/\\cyrchar\\cyrtshe /g, '\u045B'],
  [/\\cyrchar\{\\'\\cyrk\}/g, '\u045C'],
  [/\\cyrchar\\cyrushrt /g, '\u045E'],
  [/\\cyrchar\\cyrdzhe /g, '\u045F'],
  [/\\cyrchar\\CYROMEGA /g, '\u0460'],
  [/\\cyrchar\\cyromega /g, '\u0461'],
  [/\\cyrchar\\CYRYAT /g, '\u0462'],
  [/\\cyrchar\\CYRIOTE /g, '\u0464'],
  [/\\cyrchar\\cyriote /g, '\u0465'],
  [/\\cyrchar\\CYRLYUS /g, '\u0466'],
  [/\\cyrchar\\cyrlyus /g, '\u0467'],
  [/\\cyrchar\\CYRIOTLYUS /g, '\u0468'],
  [/\\cyrchar\\cyriotlyus /g, '\u0469'],
  [/\\cyrchar\\CYRBYUS /g, '\u046A'],
  [/\\cyrchar\\CYRIOTBYUS /g, '\u046C'],
  [/\\cyrchar\\cyriotbyus /g, '\u046D'],
  [/\\cyrchar\\CYRKSI /g, '\u046E'],
  [/\\cyrchar\\cyrksi /g, '\u046F'],
  [/\\cyrchar\\CYRPSI /g, '\u0470'],
  [/\\cyrchar\\cyrpsi /g, '\u0471'],
  [/\\cyrchar\\CYRFITA /g, '\u0472'],
  [/\\cyrchar\\CYRIZH /g, '\u0474'],
  [/\\cyrchar\\CYRUK /g, '\u0478'],
  [/\\cyrchar\\cyruk /g, '\u0479'],
  [/\\cyrchar\\CYROMEGARND /g, '\u047A'],
  [/\\cyrchar\\cyromegarnd /g, '\u047B'],
  [/\\cyrchar\\CYROMEGATITLO /g, '\u047C'],
  [/\\cyrchar\\cyromegatitlo /g, '\u047D'],
  [/\\cyrchar\\CYROT /g, '\u047E'],
  [/\\cyrchar\\cyrot /g, '\u047F'],
  [/\\cyrchar\\CYRKOPPA /g, '\u0480'],
  [/\\cyrchar\\cyrkoppa /g, '\u0481'],
  [/\\cyrchar\\cyrthousands /g, '\u0482'],
  [/\\cyrchar\\cyrhundredthousands /g, '\u0488'],
  [/\\cyrchar\\cyrmillions /g, '\u0489'],
  [/\\cyrchar\\CYRSEMISFTSN /g, '\u048C'],
  [/\\cyrchar\\cyrsemisftsn /g, '\u048D'],
  [/\\cyrchar\\CYRRTICK /g, '\u048E'],
  [/\\cyrchar\\cyrrtick /g, '\u048F'],
  [/\\cyrchar\\CYRGUP /g, '\u0490'],
  [/\\cyrchar\\cyrgup /g, '\u0491'],
  [/\\cyrchar\\CYRGHCRS /g, '\u0492'],
  [/\\cyrchar\\cyrghcrs /g, '\u0493'],
  [/\\cyrchar\\CYRGHK /g, '\u0494'],
  [/\\cyrchar\\cyrghk /g, '\u0495'],
  [/\\cyrchar\\CYRZHDSC /g, '\u0496'],
  [/\\cyrchar\\cyrzhdsc /g, '\u0497'],
  [/\\cyrchar\\CYRZDSC /g, '\u0498'],
  [/\\cyrchar\\cyrzdsc /g, '\u0499'],
  [/\\cyrchar\\CYRKDSC /g, '\u049A'],
  [/\\cyrchar\\cyrkdsc /g, '\u049B'],
  [/\\cyrchar\\CYRKVCRS /g, '\u049C'],
  [/\\cyrchar\\cyrkvcrs /g, '\u049D'],
  [/\\cyrchar\\CYRKHCRS /g, '\u049E'],
  [/\\cyrchar\\cyrkhcrs /g, '\u049F'],
  [/\\cyrchar\\CYRKBEAK /g, '\u04A0'],
  [/\\cyrchar\\cyrkbeak /g, '\u04A1'],
  [/\\cyrchar\\CYRNDSC /g, '\u04A2'],
  [/\\cyrchar\\cyrndsc /g, '\u04A3'],
  [/\\cyrchar\\CYRNG /g, '\u04A4'],
  [/\\cyrchar\\cyrng /g, '\u04A5'],
  [/\\cyrchar\\CYRPHK /g, '\u04A6'],
  [/\\cyrchar\\cyrphk /g, '\u04A7'],
  [/\\cyrchar\\CYRABHHA /g, '\u04A8'],
  [/\\cyrchar\\cyrabhha /g, '\u04A9'],
  [/\\cyrchar\\CYRSDSC /g, '\u04AA'],
  [/\\cyrchar\\cyrsdsc /g, '\u04AB'],
  [/\\cyrchar\\CYRTDSC /g, '\u04AC'],
  [/\\cyrchar\\cyrtdsc /g, '\u04AD'],
  [/\\cyrchar\\CYRY /g, '\u04AE'],
  [/\\cyrchar\\cyry /g, '\u04AF'],
  [/\\cyrchar\\CYRYHCRS /g, '\u04B0'],
  [/\\cyrchar\\cyryhcrs /g, '\u04B1'],
  [/\\cyrchar\\CYRHDSC /g, '\u04B2'],
  [/\\cyrchar\\cyrhdsc /g, '\u04B3'],
  [/\\cyrchar\\CYRTETSE /g, '\u04B4'],
  [/\\cyrchar\\cyrtetse /g, '\u04B5'],
  [/\\cyrchar\\CYRCHRDSC /g, '\u04B6'],
  [/\\cyrchar\\cyrchrdsc /g, '\u04B7'],
  [/\\cyrchar\\CYRCHVCRS /g, '\u04B8'],
  [/\\cyrchar\\cyrchvcrs /g, '\u04B9'],
  [/\\cyrchar\\CYRSHHA /g, '\u04BA'],
  [/\\cyrchar\\cyrshha /g, '\u04BB'],
  [/\\cyrchar\\CYRABHCH /g, '\u04BC'],
  [/\\cyrchar\\cyrabhch /g, '\u04BD'],
  [/\\cyrchar\\CYRABHCHDSC /g, '\u04BE'],
  [/\\cyrchar\\cyrabhchdsc /g, '\u04BF'],
  [/\\cyrchar\\CYRpalochka /g, '\u04C0'],
  [/\\cyrchar\\CYRKHK /g, '\u04C3'],
  [/\\cyrchar\\cyrkhk /g, '\u04C4'],
  [/\\cyrchar\\CYRNHK /g, '\u04C7'],
  [/\\cyrchar\\cyrnhk /g, '\u04C8'],
  [/\\cyrchar\\CYRCHLDSC /g, '\u04CB'],
  [/\\cyrchar\\cyrchldsc /g, '\u04CC'],
  [/\\cyrchar\\CYRAE /g, '\u04D4'],
  [/\\cyrchar\\cyrae /g, '\u04D5'],
  [/\\cyrchar\\CYRSCHWA /g, '\u04D8'],
  [/\\cyrchar\\cyrschwa /g, '\u04D9'],
  [/\\cyrchar\\CYRABHDZE /g, '\u04E0'],
  [/\\cyrchar\\cyrabhdze /g, '\u04E1'],
  [/\\cyrchar\\CYROTLD /g, '\u04E8'],
  [/\\cyrchar\\cyrotld /g, '\u04E9'],
  [/\\hspace\{0.6em\}/g, '\u2002'],
  [/\\hspace\{1em\}/g, '\u2003'],
  [/\\hspace\{0.33em\}/g, '\u2004'],
  [/\\hspace\{0.25em\}/g, '\u2005'],
  [/\\hspace\{0.166em\}/g, '\u2006'],
  [/\\hphantom\{0\}/g, '\u2007'],
  [/\\hphantom\{,\}/g, '\u2008'],
  [/\\hspace\{0.167em\}/g, '\u2009'],
  [/\\mkern1mu /g, '\u200A'],
  [/\\textendash /g, '\u2013'],
  [/\\textemdash /g, '\u2014'],
  [/\\rule\{1em\}\{1pt\}/g, '\u2015'],
  [/\\Vert /g, '\u2016'],
  [/\\Elzreapos /g, '\u201B'],
  [/\\textquotedblleft /g, '\u201C'],
  [/\\textquotedblright /g, '\u201D'],
  [/\\textdagger /g, '\u2020'],
  [/\\textdaggerdbl /g, '\u2021'],
  [/\\textbullet /g, '\u2022'],
  [/\\ldots /g, '\u2026'],
  [/\\textperthousand /g, '\u2030'],
  [/\\textpertenthousand /g, '\u2031'],
  [/\\backprime /g, '\u2035'],
  [/\\guilsinglleft /g, '\u2039'],
  [/\\guilsinglright /g, '\u203A'],
  [/\\mkern4mu /g, '\u205F'],
  [/\\nolinebreak /g, '\u2060'],
  [/\\ensuremath\{\\Elzpes\}/g, '\u20A7'],
  [/\\mbox\{\\texteuro\} /g, '\u20AC'],
  [/\\dddot /g, '\u20DB'],
  [/\\ddddot /g, '\u20DC'],
  [/\\mathbb\{C\}/g, '\u2102'],
  [/\\mathscr\{g\}/g, '\u210A'],
  [/\\mathscr\{H\}/g, '\u210B'],
  [/\\mathfrak\{H\}/g, '\u210C'],
  [/\\mathbb\{H\}/g, '\u210D'],
  [/\\hslash /g, '\u210F'],
  [/\\mathscr\{I\}/g, '\u2110'],
  [/\\mathfrak\{I\}/g, '\u2111'],
  [/\\mathscr\{L\}/g, '\u2112'],
  [/\\mathscr\{l\}/g, '\u2113'],
  [/\\mathbb\{N\}/g, '\u2115'],
  [/\\cyrchar\\textnumero /g, '\u2116'],
  [/\\wp /g, '\u2118'],
  [/\\mathbb\{P\}/g, '\u2119'],
  [/\\mathbb\{Q\}/g, '\u211A'],
  [/\\mathscr\{R\}/g, '\u211B'],
  [/\\mathfrak\{R\}/g, '\u211C'],
  [/\\mathbb\{R\}/g, '\u211D'],
  [/\\Elzxrat /g, '\u211E'],
  [/\\texttrademark /g, '\u2122'],
  [/\\mathbb\{Z\}/g, '\u2124'],
  [/\\Omega /g, '\u2126'],
  [/\\mho /g, '\u2127'],
  [/\\mathfrak\{Z\}/g, '\u2128'],
  [/\\ElsevierGlyph\{2129\}/g, '\u2129'],
  [/\\AA /g, '\u212B'],
  [/\\mathscr\{B\}/g, '\u212C'],
  [/\\mathfrak\{C\}/g, '\u212D'],
  [/\\mathscr\{e\}/g, '\u212F'],
  [/\\mathscr\{E\}/g, '\u2130'],
  [/\\mathscr\{F\}/g, '\u2131'],
  [/\\mathscr\{M\}/g, '\u2133'],
  [/\\mathscr\{o\}/g, '\u2134'],
  [/\\aleph /g, '\u2135'],
  [/\\beth /g, '\u2136'],
  [/\\gimel /g, '\u2137'],
  [/\\daleth /g, '\u2138'],
  [/\\textfrac\{1\}\{3\}/g, '\u2153'],
  [/\\textfrac\{2\}\{3\}/g, '\u2154'],
  [/\\textfrac\{1\}\{5\}/g, '\u2155'],
  [/\\textfrac\{2\}\{5\}/g, '\u2156'],
  [/\\textfrac\{3\}\{5\}/g, '\u2157'],
  [/\\textfrac\{4\}\{5\}/g, '\u2158'],
  [/\\textfrac\{1\}\{6\}/g, '\u2159'],
  [/\\textfrac\{5\}\{6\}/g, '\u215A'],
  [/\\textfrac\{1\}\{8\}/g, '\u215B'],
  [/\\textfrac\{3\}\{8\}/g, '\u215C'],
  [/\\textfrac\{5\}\{8\}/g, '\u215D'],
  [/\\textfrac\{7\}\{8\}/g, '\u215E'],
  [/\\leftarrow /g, '\u2190'],
  [/\\uparrow /g, '\u2191'],
  [/\\rightarrow /g, '\u2192'],
  [/\\downarrow /g, '\u2193'],
  [/\\leftrightarrow /g, '\u2194'],
  [/\\updownarrow /g, '\u2195'],
  [/\\nwarrow /g, '\u2196'],
  [/\\nearrow /g, '\u2197'],
  [/\\searrow /g, '\u2198'],
  [/\\swarrow /g, '\u2199'],
  [/\\nleftarrow /g, '\u219A'],
  [/\\nrightarrow /g, '\u219B'],
  [/\\arrowwaveright /g, '\u219C'],
  [/\\arrowwaveright /g, '\u219D'],
  [/\\twoheadleftarrow /g, '\u219E'],
  [/\\twoheadrightarrow /g, '\u21A0'],
  [/\\leftarrowtail /g, '\u21A2'],
  [/\\rightarrowtail /g, '\u21A3'],
  [/\\mapsto /g, '\u21A6'],
  [/\\hookleftarrow /g, '\u21A9'],
  [/\\hookrightarrow /g, '\u21AA'],
  [/\\looparrowleft /g, '\u21AB'],
  [/\\looparrowright /g, '\u21AC'],
  [/\\leftrightsquigarrow /g, '\u21AD'],
  [/\\nleftrightarrow /g, '\u21AE'],
  [/\\Lsh /g, '\u21B0'],
  [/\\Rsh /g, '\u21B1'],
  [/\\ElsevierGlyph\{21B3\}/g, '\u21B3'],
  [/\\curvearrowleft /g, '\u21B6'],
  [/\\curvearrowright /g, '\u21B7'],
  [/\\circlearrowleft /g, '\u21BA'],
  [/\\circlearrowright /g, '\u21BB'],
  [/\\leftharpoonup /g, '\u21BC'],
  [/\\leftharpoondown /g, '\u21BD'],
  [/\\upharpoonright /g, '\u21BE'],
  [/\\upharpoonleft /g, '\u21BF'],
  [/\\rightharpoonup /g, '\u21C0'],
  [/\\rightharpoondown /g, '\u21C1'],
  [/\\downharpoonright /g, '\u21C2'],
  [/\\downharpoonleft /g, '\u21C3'],
  [/\\rightleftarrows /g, '\u21C4'],
  [/\\dblarrowupdown /g, '\u21C5'],
  [/\\leftrightarrows /g, '\u21C6'],
  [/\\leftleftarrows /g, '\u21C7'],
  [/\\upuparrows /g, '\u21C8'],
  [/\\rightrightarrows /g, '\u21C9'],
  [/\\downdownarrows /g, '\u21CA'],
  [/\\leftrightharpoons /g, '\u21CB'],
  [/\\rightleftharpoons /g, '\u21CC'],
  [/\\nLeftarrow /g, '\u21CD'],
  [/\\nLeftrightarrow /g, '\u21CE'],
  [/\\nRightarrow /g, '\u21CF'],
  [/\\Leftarrow /g, '\u21D0'],
  [/\\Uparrow /g, '\u21D1'],
  [/\\Rightarrow /g, '\u21D2'],
  [/\\Downarrow /g, '\u21D3'],
  [/\\Leftrightarrow /g, '\u21D4'],
  [/\\Updownarrow /g, '\u21D5'],
  [/\\Lleftarrow /g, '\u21DA'],
  [/\\Rrightarrow /g, '\u21DB'],
  [/\\rightsquigarrow /g, '\u21DD'],
  [/\\DownArrowUpArrow /g, '\u21F5'],
  [/\\forall /g, '\u2200'],
  [/\\complement /g, '\u2201'],
  [/\\partial /g, '\u2202'],
  [/\\exists /g, '\u2203'],
  [/\\nexists /g, '\u2204'],
  [/\\varnothing /g, '\u2205'],
  [/\\nabla /g, '\u2207'],
  [/\\in /g, '\u2208'],
  [/\\not\\in /g, '\u2209'],
  [/\\ni /g, '\u220B'],
  [/\\not\\ni /g, '\u220C'],
  [/\\prod /g, '\u220F'],
  [/\\coprod /g, '\u2210'],
  [/\\sum /g, '\u2211'],
  [/\\mp /g, '\u2213'],
  [/\\dotplus /g, '\u2214'],
  [/\\setminus /g, '\u2216'],
  [/\\circ /g, '\u2218'],
  [/\\bullet /g, '\u2219'],
  [/\\surd /g, '\u221A'],
  [/\\propto /g, '\u221D'],
  [/\\infty /g, '\u221E'],
  [/\\rightangle /g, '\u221F'],
  [/\\angle /g, '\u2220'],
  [/\\measuredangle /g, '\u2221'],
  [/\\sphericalangle /g, '\u2222'],
  [/\\mid /g, '\u2223'],
  [/\\nmid /g, '\u2224'],
  [/\\parallel /g, '\u2225'],
  [/\\nparallel /g, '\u2226'],
  [/\\wedge /g, '\u2227'],
  [/\\vee /g, '\u2228'],
  [/\\cap /g, '\u2229'],
  [/\\cup /g, '\u222A'],
  [/\\int /g, '\u222B'],
  [/\\int\\!\\int /g, '\u222C'],
  [/\\int\\!\\int\\!\\int /g, '\u222D'],
  [/\\oint /g, '\u222E'],
  [/\\surfintegral /g, '\u222F'],
  [/\\volintegral /g, '\u2230'],
  [/\\clwintegral /g, '\u2231'],
  [/\\ElsevierGlyph\{2232\}/g, '\u2232'],
  [/\\ElsevierGlyph\{2233\}/g, '\u2233'],
  [/\\therefore /g, '\u2234'],
  [/\\because /g, '\u2235'],
  [/\\Colon /g, '\u2237'],
  [/\\ElsevierGlyph\{2238\}/g, '\u2238'],
  [/\\mathbin\{\{:\}\\!\\!\{\-\}\\!\\!\{:\}\}/g, '\u223A'],
  [/\\homothetic /g, '\u223B'],
  [/\\sim /g, '\u223C'],
  [/\\backsim /g, '\u223D'],
  [/\\lazysinv /g, '\u223E'],
  [/\\wr /g, '\u2240'],
  [/\\not\\sim /g, '\u2241'],
  [/\\ElsevierGlyph\{2242\}/g, '\u2242'],
  [/\\NotEqualTilde /g, '\u2242-00338'],
  [/\\simeq /g, '\u2243'],
  [/\\not\\simeq /g, '\u2244'],
  [/\\cong /g, '\u2245'],
  [/\\approxnotequal /g, '\u2246'],
  [/\\not\\cong /g, '\u2247'],
  [/\\approx /g, '\u2248'],
  [/\\not\\approx /g, '\u2249'],
  [/\\approxeq /g, '\u224A'],
  [/\\tildetrpl /g, '\u224B'],
  [/\\not\\apid /g, '\u224B-00338'],
  [/\\allequal /g, '\u224C'],
  [/\\asymp /g, '\u224D'],
  [/\\Bumpeq /g, '\u224E'],
  [/\\NotHumpDownHump /g, '\u224E-00338'],
  [/\\bumpeq /g, '\u224F'],
  [/\\NotHumpEqual /g, '\u224F-00338'],
  [/\\doteq /g, '\u2250'],
  [/\\not\\doteq/g, '\u2250-00338'],
  [/\\doteqdot /g, '\u2251'],
  [/\\fallingdotseq /g, '\u2252'],
  [/\\risingdotseq /g, '\u2253'],
  [/\\eqcirc /g, '\u2256'],
  [/\\circeq /g, '\u2257'],
  [/\\estimates /g, '\u2259'],
  [/\\ElsevierGlyph\{225A\}/g, '\u225A'],
  [/\\starequal /g, '\u225B'],
  [/\\triangleq /g, '\u225C'],
  [/\\ElsevierGlyph\{225F\}/g, '\u225F'],
  [/\\not =/g, '\u2260'],
  [/\\equiv /g, '\u2261'],
  [/\\not\\equiv /g, '\u2262'],
  [/\\leq /g, '\u2264'],
  [/\\geq /g, '\u2265'],
  [/\\leqq /g, '\u2266'],
  [/\\geqq /g, '\u2267'],
  [/\\lneqq /g, '\u2268'],
  [/\\lvertneqq /g, '\u2268-0FE00'],
  [/\\gneqq /g, '\u2269'],
  [/\\gvertneqq /g, '\u2269-0FE00'],
  [/\\ll /g, '\u226A'],
  [/\\NotLessLess /g, '\u226A-00338'],
  [/\\gg /g, '\u226B'],
  [/\\NotGreaterGreater /g, '\u226B-00338'],
  [/\\between /g, '\u226C'],
  [/\\not\\kern\-0.3em\\times /g, '\u226D'],
  [/\\not</g, '\u226E'],
  [/\\not>/g, '\u226F'],
  [/\\not\\leq /g, '\u2270'],
  [/\\not\\geq /g, '\u2271'],
  [/\\lessequivlnt /g, '\u2272'],
  [/\\greaterequivlnt /g, '\u2273'],
  [/\\ElsevierGlyph\{2274\}/g, '\u2274'],
  [/\\ElsevierGlyph\{2275\}/g, '\u2275'],
  [/\\lessgtr /g, '\u2276'],
  [/\\gtrless /g, '\u2277'],
  [/\\notlessgreater /g, '\u2278'],
  [/\\notgreaterless /g, '\u2279'],
  [/\\prec /g, '\u227A'],
  [/\\succ /g, '\u227B'],
  [/\\preccurlyeq /g, '\u227C'],
  [/\\succcurlyeq /g, '\u227D'],
  [/\\precapprox /g, '\u227E'],
  [/\\NotPrecedesTilde /g, '\u227E-00338'],
  [/\\succapprox /g, '\u227F'],
  [/\\NotSucceedsTilde /g, '\u227F-00338'],
  [/\\not\\prec /g, '\u2280'],
  [/\\not\\succ /g, '\u2281'],
  [/\\subset /g, '\u2282'],
  [/\\supset /g, '\u2283'],
  [/\\not\\subset /g, '\u2284'],
  [/\\not\\supset /g, '\u2285'],
  [/\\subseteq /g, '\u2286'],
  [/\\supseteq /g, '\u2287'],
  [/\\not\\subseteq /g, '\u2288'],
  [/\\not\\supseteq /g, '\u2289'],
  [/\\subsetneq /g, '\u228A'],
  [/\\varsubsetneqq /g, '\u228A-0FE00'],
  [/\\supsetneq /g, '\u228B'],
  [/\\varsupsetneq /g, '\u228B-0FE00'],
  [/\\uplus /g, '\u228E'],
  [/\\sqsubset /g, '\u228F'],
  [/\\NotSquareSubset /g, '\u228F-00338'],
  [/\\sqsupset /g, '\u2290'],
  [/\\NotSquareSuperset /g, '\u2290-00338'],
  [/\\sqsubseteq /g, '\u2291'],
  [/\\sqsupseteq /g, '\u2292'],
  [/\\sqcap /g, '\u2293'],
  [/\\sqcup /g, '\u2294'],
  [/\\oplus /g, '\u2295'],
  [/\\ominus /g, '\u2296'],
  [/\\otimes /g, '\u2297'],
  [/\\oslash /g, '\u2298'],
  [/\\odot /g, '\u2299'],
  [/\\circledcirc /g, '\u229A'],
  [/\\circledast /g, '\u229B'],
  [/\\circleddash /g, '\u229D'],
  [/\\boxplus /g, '\u229E'],
  [/\\boxminus /g, '\u229F'],
  [/\\boxtimes /g, '\u22A0'],
  [/\\boxdot /g, '\u22A1'],
  [/\\vdash /g, '\u22A2'],
  [/\\dashv /g, '\u22A3'],
  [/\\top /g, '\u22A4'],
  [/\\perp /g, '\u22A5'],
  [/\\truestate /g, '\u22A7'],
  [/\\forcesextra /g, '\u22A8'],
  [/\\Vdash /g, '\u22A9'],
  [/\\Vvdash /g, '\u22AA'],
  [/\\VDash /g, '\u22AB'],
  [/\\nvdash /g, '\u22AC'],
  [/\\nvDash /g, '\u22AD'],
  [/\\nVdash /g, '\u22AE'],
  [/\\nVDash /g, '\u22AF'],
  [/\\vartriangleleft /g, '\u22B2'],
  [/\\vartriangleright /g, '\u22B3'],
  [/\\trianglelefteq /g, '\u22B4'],
  [/\\trianglerighteq /g, '\u22B5'],
  [/\\original /g, '\u22B6'],
  [/\\image /g, '\u22B7'],
  [/\\multimap /g, '\u22B8'],
  [/\\hermitconjmatrix /g, '\u22B9'],
  [/\\intercal /g, '\u22BA'],
  [/\\veebar /g, '\u22BB'],
  [/\\rightanglearc /g, '\u22BE'],
  [/\\ElsevierGlyph\{22C0\}/g, '\u22C0'],
  [/\\ElsevierGlyph\{22C1\}/g, '\u22C1'],
  [/\\bigcap /g, '\u22C2'],
  [/\\bigcup /g, '\u22C3'],
  [/\\diamond /g, '\u22C4'],
  [/\\cdot /g, '\u22C5'],
  [/\\star /g, '\u22C6'],
  [/\\divideontimes /g, '\u22C7'],
  [/\\bowtie /g, '\u22C8'],
  [/\\ltimes /g, '\u22C9'],
  [/\\rtimes /g, '\u22CA'],
  [/\\leftthreetimes /g, '\u22CB'],
  [/\\rightthreetimes /g, '\u22CC'],
  [/\\backsimeq /g, '\u22CD'],
  [/\\curlyvee /g, '\u22CE'],
  [/\\curlywedge /g, '\u22CF'],
  [/\\Subset /g, '\u22D0'],
  [/\\Supset /g, '\u22D1'],
  [/\\Cap /g, '\u22D2'],
  [/\\Cup /g, '\u22D3'],
  [/\\pitchfork /g, '\u22D4'],
  [/\\lessdot /g, '\u22D6'],
  [/\\gtrdot /g, '\u22D7'],
  [/\\verymuchless /g, '\u22D8'],
  [/\\verymuchgreater /g, '\u22D9'],
  [/\\lesseqgtr /g, '\u22DA'],
  [/\\gtreqless /g, '\u22DB'],
  [/\\curlyeqprec /g, '\u22DE'],
  [/\\curlyeqsucc /g, '\u22DF'],
  [/\\not\\sqsubseteq /g, '\u22E2'],
  [/\\not\\sqsupseteq /g, '\u22E3'],
  [/\\Elzsqspne /g, '\u22E5'],
  [/\\lnsim /g, '\u22E6'],
  [/\\gnsim /g, '\u22E7'],
  [/\\precedesnotsimilar /g, '\u22E8'],
  [/\\succnsim /g, '\u22E9'],
  [/\\ntriangleleft /g, '\u22EA'],
  [/\\ntriangleright /g, '\u22EB'],
  [/\\ntrianglelefteq /g, '\u22EC'],
  [/\\ntrianglerighteq /g, '\u22ED'],
  [/\\vdots /g, '\u22EE'],
  [/\\cdots /g, '\u22EF'],
  [/\\upslopeellipsis /g, '\u22F0'],
  [/\\downslopeellipsis /g, '\u22F1'],
  [/\\barwedge /g, '\u2305'],
  [/\\perspcorrespond /g, '\u2306'],
  [/\\lceil /g, '\u2308'],
  [/\\rceil /g, '\u2309'],
  [/\\lfloor /g, '\u230A'],
  [/\\rfloor /g, '\u230B'],
  [/\\recorder /g, '\u2315'],
  [/\\mathchar"2208/g, '\u2316'],
  [/\\ulcorner /g, '\u231C'],
  [/\\urcorner /g, '\u231D'],
  [/\\llcorner /g, '\u231E'],
  [/\\lrcorner /g, '\u231F'],
  [/\\frown /g, '\u2322'],
  [/\\smile /g, '\u2323'],
  [/\\langle /g, '\u2329'],
  [/\\rangle /g, '\u232A'],
  [/\\ElsevierGlyph\{E838\}/g, '\u233D'],
  [/\\Elzdlcorn /g, '\u23A3'],
  [/\\lmoustache /g, '\u23B0'],
  [/\\rmoustache /g, '\u23B1'],
  [/\\textvisiblespace /g, '\u2423'],
  [/\\ding\{172\}/g, '\u2460'],
  [/\\ding\{173\}/g, '\u2461'],
  [/\\ding\{174\}/g, '\u2462'],
  [/\\ding\{175\}/g, '\u2463'],
  [/\\ding\{176\}/g, '\u2464'],
  [/\\ding\{177\}/g, '\u2465'],
  [/\\ding\{178\}/g, '\u2466'],
  [/\\ding\{179\}/g, '\u2467'],
  [/\\ding\{180\}/g, '\u2468'],
  [/\\ding\{181\}/g, '\u2469'],
  [/\\circledS /g, '\u24C8'],
  [/\\Elzdshfnc /g, '\u2506'],
  [/\\Elzsqfnw /g, '\u2519'],
  [/\\diagup /g, '\u2571'],
  [/\\ding\{110\}/g, '\u25A0'],
  [/\\square /g, '\u25A1'],
  [/\\blacksquare /g, '\u25AA'],
  [/\\fbox\{~~\}/g, '\u25AD'],
  [/\\Elzvrecto /g, '\u25AF'],
  [/\\ElsevierGlyph\{E381\}/g, '\u25B1'],
  [/\\ding\{115\}/g, '\u25B2'],
  [/\\bigtriangleup /g, '\u25B3'],
  [/\\blacktriangle /g, '\u25B4'],
  [/\\vartriangle /g, '\u25B5'],
  [/\\blacktriangleright /g, '\u25B8'],
  [/\\triangleright /g, '\u25B9'],
  [/\\ding\{116\}/g, '\u25BC'],
  [/\\bigtriangledown /g, '\u25BD'],
  [/\\blacktriangledown /g, '\u25BE'],
  [/\\triangledown /g, '\u25BF'],
  [/\\blacktriangleleft /g, '\u25C2'],
  [/\\triangleleft /g, '\u25C3'],
  [/\\ding\{117\}/g, '\u25C6'],
  [/\\lozenge /g, '\u25CA'],
  [/\\bigcirc /g, '\u25CB'],
  [/\\ding\{108\}/g, '\u25CF'],
  [/\\Elzcirfl /g, '\u25D0'],
  [/\\Elzcirfr /g, '\u25D1'],
  [/\\Elzcirfb /g, '\u25D2'],
  [/\\ding\{119\}/g, '\u25D7'],
  [/\\Elzrvbull /g, '\u25D8'],
  [/\\Elzsqfl /g, '\u25E7'],
  [/\\Elzsqfr /g, '\u25E8'],
  [/\\Elzsqfse /g, '\u25EA'],
  [/\\bigcirc /g, '\u25EF'],
  [/\\ding\{72\}/g, '\u2605'],
  [/\\ding\{73\}/g, '\u2606'],
  [/\\ding\{37\}/g, '\u260E'],
  [/\\ding\{42\}/g, '\u261B'],
  [/\\ding\{43\}/g, '\u261E'],
  [/\\rightmoon /g, '\u263E'],
  [/\\mercury /g, '\u263F'],
  [/\\venus /g, '\u2640'],
  [/\\male /g, '\u2642'],
  [/\\jupiter /g, '\u2643'],
  [/\\saturn /g, '\u2644'],
  [/\\uranus /g, '\u2645'],
  [/\\neptune /g, '\u2646'],
  [/\\pluto /g, '\u2647'],
  [/\\aries /g, '\u2648'],
  [/\\taurus /g, '\u2649'],
  [/\\gemini /g, '\u264A'],
  [/\\cancer /g, '\u264B'],
  [/\\leo /g, '\u264C'],
  [/\\virgo /g, '\u264D'],
  [/\\libra /g, '\u264E'],
  [/\\scorpio /g, '\u264F'],
  [/\\sagittarius /g, '\u2650'],
  [/\\capricornus /g, '\u2651'],
  [/\\aquarius /g, '\u2652'],
  [/\\pisces /g, '\u2653'],
  [/\\ding\{171\}/g, '\u2660'],
  [/\\diamond /g, '\u2662'],
  [/\\ding\{168\}/g, '\u2663'],
  [/\\ding\{170\}/g, '\u2665'],
  [/\\ding\{169\}/g, '\u2666'],
  [/\\quarternote /g, '\u2669'],
  [/\\eighthnote /g, '\u266A'],
  [/\\flat /g, '\u266D'],
  [/\\natural /g, '\u266E'],
  [/\\sharp /g, '\u266F'],
  [/\\ding\{33\}/g, '\u2701'],
  [/\\ding\{34\}/g, '\u2702'],
  [/\\ding\{35\}/g, '\u2703'],
  [/\\ding\{36\}/g, '\u2704'],
  [/\\ding\{38\}/g, '\u2706'],
  [/\\ding\{39\}/g, '\u2707'],
  [/\\ding\{40\}/g, '\u2708'],
  [/\\ding\{41\}/g, '\u2709'],
  [/\\ding\{44\}/g, '\u270C'],
  [/\\ding\{45\}/g, '\u270D'],
  [/\\ding\{46\}/g, '\u270E'],
  [/\\ding\{47\}/g, '\u270F'],
  [/\\ding\{48\}/g, '\u2710'],
  [/\\ding\{49\}/g, '\u2711'],
  [/\\ding\{50\}/g, '\u2712'],
  [/\\ding\{51\}/g, '\u2713'],
  [/\\ding\{52\}/g, '\u2714'],
  [/\\ding\{53\}/g, '\u2715'],
  [/\\ding\{54\}/g, '\u2716'],
  [/\\ding\{55\}/g, '\u2717'],
  [/\\ding\{56\}/g, '\u2718'],
  [/\\ding\{57\}/g, '\u2719'],
  [/\\ding\{58\}/g, '\u271A'],
  [/\\ding\{59\}/g, '\u271B'],
  [/\\ding\{60\}/g, '\u271C'],
  [/\\ding\{61\}/g, '\u271D'],
  [/\\ding\{62\}/g, '\u271E'],
  [/\\ding\{63\}/g, '\u271F'],
  [/\\ding\{64\}/g, '\u2720'],
  [/\\ding\{65\}/g, '\u2721'],
  [/\\ding\{66\}/g, '\u2722'],
  [/\\ding\{67\}/g, '\u2723'],
  [/\\ding\{68\}/g, '\u2724'],
  [/\\ding\{69\}/g, '\u2725'],
  [/\\ding\{70\}/g, '\u2726'],
  [/\\ding\{71\}/g, '\u2727'],
  [/\\ding\{73\}/g, '\u2729'],
  [/\\ding\{74\}/g, '\u272A'],
  [/\\ding\{75\}/g, '\u272B'],
  [/\\ding\{76\}/g, '\u272C'],
  [/\\ding\{77\}/g, '\u272D'],
  [/\\ding\{78\}/g, '\u272E'],
  [/\\ding\{79\}/g, '\u272F'],
  [/\\ding\{80\}/g, '\u2730'],
  [/\\ding\{81\}/g, '\u2731'],
  [/\\ding\{82\}/g, '\u2732'],
  [/\\ding\{83\}/g, '\u2733'],
  [/\\ding\{84\}/g, '\u2734'],
  [/\\ding\{85\}/g, '\u2735'],
  [/\\ding\{86\}/g, '\u2736'],
  [/\\ding\{87\}/g, '\u2737'],
  [/\\ding\{88\}/g, '\u2738'],
  [/\\ding\{89\}/g, '\u2739'],
  [/\\ding\{90\}/g, '\u273A'],
  [/\\ding\{91\}/g, '\u273B'],
  [/\\ding\{92\}/g, '\u273C'],
  [/\\ding\{93\}/g, '\u273D'],
  [/\\ding\{94\}/g, '\u273E'],
  [/\\ding\{95\}/g, '\u273F'],
  [/\\ding\{96\}/g, '\u2740'],
  [/\\ding\{97\}/g, '\u2741'],
  [/\\ding\{98\}/g, '\u2742'],
  [/\\ding\{99\}/g, '\u2743'],
  [/\\ding\{100\}/g, '\u2744'],
  [/\\ding\{101\}/g, '\u2745'],
  [/\\ding\{102\}/g, '\u2746'],
  [/\\ding\{103\}/g, '\u2747'],
  [/\\ding\{104\}/g, '\u2748'],
  [/\\ding\{105\}/g, '\u2749'],
  [/\\ding\{106\}/g, '\u274A'],
  [/\\ding\{107\}/g, '\u274B'],
  [/\\ding\{109\}/g, '\u274D'],
  [/\\ding\{111\}/g, '\u274F'],
  [/\\ding\{112\}/g, '\u2750'],
  [/\\ding\{113\}/g, '\u2751'],
  [/\\ding\{114\}/g, '\u2752'],
  [/\\ding\{118\}/g, '\u2756'],
  [/\\ding\{120\}/g, '\u2758'],
  [/\\ding\{121\}/g, '\u2759'],
  [/\\ding\{122\}/g, '\u275A'],
  [/\\ding\{123\}/g, '\u275B'],
  [/\\ding\{124\}/g, '\u275C'],
  [/\\ding\{125\}/g, '\u275D'],
  [/\\ding\{126\}/g, '\u275E'],
  [/\\ding\{161\}/g, '\u2761'],
  [/\\ding\{162\}/g, '\u2762'],
  [/\\ding\{163\}/g, '\u2763'],
  [/\\ding\{164\}/g, '\u2764'],
  [/\\ding\{165\}/g, '\u2765'],
  [/\\ding\{166\}/g, '\u2766'],
  [/\\ding\{167\}/g, '\u2767'],
  [/\\ding\{182\}/g, '\u2776'],
  [/\\ding\{183\}/g, '\u2777'],
  [/\\ding\{184\}/g, '\u2778'],
  [/\\ding\{185\}/g, '\u2779'],
  [/\\ding\{186\}/g, '\u277A'],
  [/\\ding\{187\}/g, '\u277B'],
  [/\\ding\{188\}/g, '\u277C'],
  [/\\ding\{189\}/g, '\u277D'],
  [/\\ding\{190\}/g, '\u277E'],
  [/\\ding\{191\}/g, '\u277F'],
  [/\\ding\{192\}/g, '\u2780'],
  [/\\ding\{193\}/g, '\u2781'],
  [/\\ding\{194\}/g, '\u2782'],
  [/\\ding\{195\}/g, '\u2783'],
  [/\\ding\{196\}/g, '\u2784'],
  [/\\ding\{197\}/g, '\u2785'],
  [/\\ding\{198\}/g, '\u2786'],
  [/\\ding\{199\}/g, '\u2787'],
  [/\\ding\{200\}/g, '\u2788'],
  [/\\ding\{201\}/g, '\u2789'],
  [/\\ding\{202\}/g, '\u278A'],
  [/\\ding\{203\}/g, '\u278B'],
  [/\\ding\{204\}/g, '\u278C'],
  [/\\ding\{205\}/g, '\u278D'],
  [/\\ding\{206\}/g, '\u278E'],
  [/\\ding\{207\}/g, '\u278F'],
  [/\\ding\{208\}/g, '\u2790'],
  [/\\ding\{209\}/g, '\u2791'],
  [/\\ding\{210\}/g, '\u2792'],
  [/\\ding\{211\}/g, '\u2793'],
  [/\\ding\{212\}/g, '\u2794'],
  [/\\ding\{216\}/g, '\u2798'],
  [/\\ding\{217\}/g, '\u2799'],
  [/\\ding\{218\}/g, '\u279A'],
  [/\\ding\{219\}/g, '\u279B'],
  [/\\ding\{220\}/g, '\u279C'],
  [/\\ding\{221\}/g, '\u279D'],
  [/\\ding\{222\}/g, '\u279E'],
  [/\\ding\{223\}/g, '\u279F'],
  [/\\ding\{224\}/g, '\u27A0'],
  [/\\ding\{225\}/g, '\u27A1'],
  [/\\ding\{226\}/g, '\u27A2'],
  [/\\ding\{227\}/g, '\u27A3'],
  [/\\ding\{228\}/g, '\u27A4'],
  [/\\ding\{229\}/g, '\u27A5'],
  [/\\ding\{230\}/g, '\u27A6'],
  [/\\ding\{231\}/g, '\u27A7'],
  [/\\ding\{232\}/g, '\u27A8'],
  [/\\ding\{233\}/g, '\u27A9'],
  [/\\ding\{234\}/g, '\u27AA'],
  [/\\ding\{235\}/g, '\u27AB'],
  [/\\ding\{236\}/g, '\u27AC'],
  [/\\ding\{237\}/g, '\u27AD'],
  [/\\ding\{238\}/g, '\u27AE'],
  [/\\ding\{239\}/g, '\u27AF'],
  [/\\ding\{241\}/g, '\u27B1'],
  [/\\ding\{242\}/g, '\u27B2'],
  [/\\ding\{243\}/g, '\u27B3'],
  [/\\ding\{244\}/g, '\u27B4'],
  [/\\ding\{245\}/g, '\u27B5'],
  [/\\ding\{246\}/g, '\u27B6'],
  [/\\ding\{247\}/g, '\u27B7'],
  [/\\ding\{248\}/g, '\u27B8'],
  [/\\ding\{249\}/g, '\u27B9'],
  [/\\ding\{250\}/g, '\u27BA'],
  [/\\ding\{251\}/g, '\u27BB'],
  [/\\ding\{252\}/g, '\u27BC'],
  [/\\ding\{253\}/g, '\u27BD'],
  [/\\ding\{254\}/g, '\u27BE'],
  [/\\longleftarrow /g, '\u27F5'],
  [/\\longrightarrow /g, '\u27F6'],
  [/\\longleftrightarrow /g, '\u27F7'],
  [/\\Longleftarrow /g, '\u27F8'],
  [/\\Longrightarrow /g, '\u27F9'],
  [/\\Longleftrightarrow /g, '\u27FA'],
  [/\\longmapsto /g, '\u27FC'],
  [/\\sim\\joinrel\\leadsto/g, '\u27FF'],
  [/\\ElsevierGlyph\{E212\}/g, '\u2905'],
  [/\\UpArrowBar /g, '\u2912'],
  [/\\DownArrowBar /g, '\u2913'],
  [/\\ElsevierGlyph\{E20C\}/g, '\u2923'],
  [/\\ElsevierGlyph\{E20D\}/g, '\u2924'],
  [/\\ElsevierGlyph\{E20B\}/g, '\u2925'],
  [/\\ElsevierGlyph\{E20A\}/g, '\u2926'],
  [/\\ElsevierGlyph\{E211\}/g, '\u2927'],
  [/\\ElsevierGlyph\{E20E\}/g, '\u2928'],
  [/\\ElsevierGlyph\{E20F\}/g, '\u2929'],
  [/\\ElsevierGlyph\{E210\}/g, '\u292A'],
  [/\\ElsevierGlyph\{E21C\}/g, '\u2933'],
  [/\\ElsevierGlyph\{E21D\}/g, '\u2933-00338'],
  [/\\ElsevierGlyph\{E21A\}/g, '\u2936'],
  [/\\ElsevierGlyph\{E219\}/g, '\u2937'],
  [/\\Elolarr /g, '\u2940'],
  [/\\Elorarr /g, '\u2941'],
  [/\\ElzRlarr /g, '\u2942'],
  [/\\ElzrLarr /g, '\u2944'],
  [/\\Elzrarrx /g, '\u2947'],
  [/\\LeftRightVector /g, '\u294E'],
  [/\\RightUpDownVector /g, '\u294F'],
  [/\\DownLeftRightVector /g, '\u2950'],
  [/\\LeftUpDownVector /g, '\u2951'],
  [/\\LeftVectorBar /g, '\u2952'],
  [/\\RightVectorBar /g, '\u2953'],
  [/\\RightUpVectorBar /g, '\u2954'],
  [/\\RightDownVectorBar /g, '\u2955'],
  [/\\DownLeftVectorBar /g, '\u2956'],
  [/\\DownRightVectorBar /g, '\u2957'],
  [/\\LeftUpVectorBar /g, '\u2958'],
  [/\\LeftDownVectorBar /g, '\u2959'],
  [/\\LeftTeeVector /g, '\u295A'],
  [/\\RightTeeVector /g, '\u295B'],
  [/\\RightUpTeeVector /g, '\u295C'],
  [/\\RightDownTeeVector /g, '\u295D'],
  [/\\DownLeftTeeVector /g, '\u295E'],
  [/\\DownRightTeeVector /g, '\u295F'],
  [/\\LeftUpTeeVector /g, '\u2960'],
  [/\\LeftDownTeeVector /g, '\u2961'],
  [/\\UpEquilibrium /g, '\u296E'],
  [/\\ReverseUpEquilibrium /g, '\u296F'],
  [/\\RoundImplies /g, '\u2970'],
  [/\\ElsevierGlyph\{E214\}/g, '\u297C'],
  [/\\ElsevierGlyph\{E215\}/g, '\u297D'],
  [/\\Elztfnc /g, '\u2980'],
  [/\\ElsevierGlyph\{3018\}/g, '\u2985'],
  [/\\Elroang /g, '\u2986'],
  [/\\ElsevierGlyph\{E291\}/g, '\u2994'],
  [/\\Elzddfnc /g, '\u2999'],
  [/\\Angle /g, '\u299C'],
  [/\\Elzlpargt /g, '\u29A0'],
  [/\\ElsevierGlyph\{E260\}/g, '\u29B5'],
  [/\\ElsevierGlyph\{E61B\}/g, '\u29B6'],
  [/\\ElzLap /g, '\u29CA'],
  [/\\Elzdefas /g, '\u29CB'],
  [/\\LeftTriangleBar /g, '\u29CF'],
  [/\\NotLeftTriangleBar /g, '\u29CF-00338'],
  [/\\RightTriangleBar /g, '\u29D0'],
  [/\\NotRightTriangleBar /g, '\u29D0-00338'],
  [/\\ElsevierGlyph\{E372\}/g, '\u29DC'],
  [/\\blacklozenge /g, '\u29EB'],
  [/\\RuleDelayed /g, '\u29F4'],
  [/\\Elxuplus /g, '\u2A04'],
  [/\\ElzThr /g, '\u2A05'],
  [/\\Elxsqcup /g, '\u2A06'],
  [/\\ElzInf /g, '\u2A07'],
  [/\\ElzSup /g, '\u2A08'],
  [/\\ElzCint /g, '\u2A0D'],
  [/\\clockoint /g, '\u2A0F'],
  [/\\ElsevierGlyph\{E395\}/g, '\u2A10'],
  [/\\sqrint /g, '\u2A16'],
  [/\\ElsevierGlyph\{E25A\}/g, '\u2A25'],
  [/\\ElsevierGlyph\{E25B\}/g, '\u2A2A'],
  [/\\ElsevierGlyph\{E25C\}/g, '\u2A2D'],
  [/\\ElsevierGlyph\{E25D\}/g, '\u2A2E'],
  [/\\ElzTimes /g, '\u2A2F'],
  [/\\ElsevierGlyph\{E25E\}/g, '\u2A34'],
  [/\\ElsevierGlyph\{E25E\}/g, '\u2A35'],
  [/\\ElsevierGlyph\{E259\}/g, '\u2A3C'],
  [/\\amalg /g, '\u2A3F'],
  [/\\ElzAnd /g, '\u2A53'],
  [/\\ElzOr /g, '\u2A54'],
  [/\\ElsevierGlyph\{E36E\}/g, '\u2A55'],
  [/\\ElOr /g, '\u2A56'],
  [/\\perspcorrespond /g, '\u2A5E'],
  [/\\Elzminhat /g, '\u2A5F'],
  [/\\ElsevierGlyph\{225A\}/g, '\u2A63'],
  [/\\stackrel\{*\}\{=\}/g, '\u2A6E'],
  [/\\Equal /g, '\u2A75'],
  [/\\leqslant /g, '\u2A7D'],
  [/\\nleqslant /g, '\u2A7D-00338'],
  [/\\geqslant /g, '\u2A7E'],
  [/\\ngeqslant /g, '\u2A7E-00338'],
  [/\\lessapprox /g, '\u2A85'],
  [/\\gtrapprox /g, '\u2A86'],
  [/\\lneq /g, '\u2A87'],
  [/\\gneq /g, '\u2A88'],
  [/\\lnapprox /g, '\u2A89'],
  [/\\gnapprox /g, '\u2A8A'],
  [/\\lesseqqgtr /g, '\u2A8B'],
  [/\\gtreqqless /g, '\u2A8C'],
  [/\\eqslantless /g, '\u2A95'],
  [/\\eqslantgtr /g, '\u2A96'],
  [/\\Pisymbol\{ppi020\}\{117\}/g, '\u2A9D'],
  [/\\Pisymbol\{ppi020\}\{105\}/g, '\u2A9E'],
  [/\\NestedLessLess /g, '\u2AA1'],
  [/\\NotNestedLessLess /g, '\u2AA1-00338'],
  [/\\NestedGreaterGreater /g, '\u2AA2'],
  [/\\NotNestedGreaterGreater /g, '\u2AA2-00338'],
  [/\\preceq /g, '\u2AAF'],
  [/\\not\\preceq /g, '\u2AAF-00338'],
  [/\\succeq /g, '\u2AB0'],
  [/\\not\\succeq /g, '\u2AB0-00338'],
  [/\\precneqq /g, '\u2AB5'],
  [/\\succneqq /g, '\u2AB6'],
  [/\\precapprox /g, '\u2AB7'],
  [/\\succapprox /g, '\u2AB8'],
  [/\\precnapprox /g, '\u2AB9'],
  [/\\succnapprox /g, '\u2ABA'],
  [/\\subseteqq /g, '\u2AC5'],
  [/\\nsubseteqq /g, '\u2AC5-00338'],
  [/\\supseteqq /g, '\u2AC6'],
  [/\\nsupseteqq/g, '\u2AC6-00338'],
  [/\\subsetneqq /g, '\u2ACB'],
  [/\\supsetneqq /g, '\u2ACC'],
  [/\\ElsevierGlyph\{E30D\}/g, '\u2AEB'],
  [/\\Elztdcol /g, '\u2AF6'],
  [/\\ElsevierGlyph\{300A\}/g, '\u300A'],
  [/\\ElsevierGlyph\{300B\}/g, '\u300B'],
  [/\\ElsevierGlyph\{3018\}/g, '\u3018'],
  [/\\ElsevierGlyph\{3019\}/g, '\u3019'],
  [/\\openbracketleft /g, '\u301A'],
  [/\\openbracketright /g, '\u301B'],
]

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BibtexParser
}
