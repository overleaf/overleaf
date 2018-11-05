/* eslint-disable
    max-len,
    no-cond-assign,
    no-return-assign,
    no-undef,
    no-unused-vars,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS202: Simplify dynamic range loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'ide/editor/directives/aceEditor/auto-complete/CommandManager',
  'ide/editor/directives/aceEditor/auto-complete/EnvironmentManager',
  'ide/editor/directives/aceEditor/auto-complete/PackageManager',
  'ide/editor/directives/aceEditor/auto-complete/Helpers',
  'ace/ace',
  'ace/ext-language_tools'
], function(CommandManager, EnvironmentManager, PackageManager, Helpers) {
  let AutoCompleteManager
  const { Range } = ace.require('ace/range')
  const aceSnippetManager = ace.require('ace/snippets').snippetManager

  return (AutoCompleteManager = class AutoCompleteManager {
    constructor(
      $scope,
      editor,
      element,
      metadataManager,
      graphics,
      preamble,
      files
    ) {
      this.$scope = $scope
      this.editor = editor
      this.element = element
      this.metadataManager = metadataManager
      this.graphics = graphics
      this.preamble = preamble
      this.files = files
      this.monkeyPatchAutocomplete()

      this.$scope.$watch('autoComplete', autocomplete => {
        if (autocomplete) {
          return this.enable()
        } else {
          return this.disable()
        }
      })

      const onChange = change => {
        return this.onChange(change)
      }

      this.editor.on('changeSession', e => {
        e.oldSession.off('change', onChange)
        return e.session.on('change', onChange)
      })
    }

    enable() {
      this.editor.setOptions({
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: false
      })

      const CommandCompleter = new CommandManager(this.metadataManager)
      const SnippetCompleter = new EnvironmentManager()
      const PackageCompleter = new PackageManager(this.metadataManager, Helpers)

      const Graphics = this.graphics
      const Preamble = this.preamble
      const Files = this.files

      const GraphicsCompleter = {
        getCompletions(editor, session, pos, prefix, callback) {
          const { commandFragment } = Helpers.getContext(editor, pos)
          if (commandFragment) {
            const match = commandFragment.match(
              /^~?\\(includegraphics(?:\[.*])?){([^}]*, *)?(\w*)/
            )
            if (match) {
              let [_ignore1, commandName, _ignore2, currentArg] = Array.from(
                match
              )
              const graphicsPaths = Preamble.getGraphicsPaths()
              const result = []
              for (let graphic of Array.from(Graphics.getGraphicsFiles())) {
                let { path } = graphic
                for (let graphicsPath of Array.from(graphicsPaths)) {
                  if (path.indexOf(graphicsPath) === 0) {
                    path = path.slice(graphicsPath.length)
                    break
                  }
                }
                result.push({
                  caption: `\\${commandName}{${path}}`,
                  value: `\\${commandName}{${path}}`,
                  meta: 'graphic',
                  score: 50
                })
              }
              return callback(null, result)
            }
          }
        }
      }

      const { metadataManager } = this
      const FilesCompleter = {
        getCompletions: (editor, session, pos, prefix, callback) => {
          const { commandFragment } = Helpers.getContext(editor, pos)
          if (commandFragment) {
            const match = commandFragment.match(/^\\(input|include){(\w*)/)
            if (match) {
              const [_, commandName, currentArg] = Array.from(match)
              const result = []
              for (let file of Array.from(Files.getTeXFiles())) {
                if (file.id !== this.$scope.docId) {
                  const { path } = file
                  result.push({
                    caption: `\\${commandName}{${path}}`,
                    value: `\\${commandName}{${path}}`,
                    meta: 'file',
                    score: 50
                  })
                }
              }
              return callback(null, result)
            }
          }
        }
      }

      const LabelsCompleter = {
        getCompletions(editor, session, pos, prefix, callback) {
          const { commandFragment } = Helpers.getContext(editor, pos)
          if (commandFragment) {
            const refMatch = commandFragment.match(
              /^~?\\([a-zA-Z]*ref){([^}]*, *)?(\w*)/
            )
            if (refMatch) {
              const [_, commandName, currentArg] = Array.from(refMatch)
              const result = []
              if (commandName !== 'ref') {
                // ref is in top 100 commands
                result.push({
                  caption: `\\${commandName}{}`,
                  snippet: `\\${commandName}{}`,
                  meta: 'cross-reference',
                  score: 60
                })
              }
              for (let label of Array.from(metadataManager.getAllLabels())) {
                result.push({
                  caption: `\\${commandName}{${label}}`,
                  value: `\\${commandName}{${label}}`,
                  meta: 'cross-reference',
                  score: 50
                })
              }
              return callback(null, result)
            }
          }
        }
      }

      const references = this.$scope.$root._references
      const ReferencesCompleter = {
        getCompletions(editor, session, pos, prefix, callback) {
          const { commandFragment } = Helpers.getContext(editor, pos)
          if (commandFragment) {
            const citeMatch = commandFragment.match(
              /^~?\\([a-z]*cite[a-z]*(?:\[.*])?){([^}]*, *)?(\w*)/
            )
            if (citeMatch) {
              let [_, commandName, previousArgs, currentArg] = Array.from(
                citeMatch
              )
              if (previousArgs == null) {
                previousArgs = ''
              }
              const previousArgsCaption =
                previousArgs.length > 8 ? '…,' : previousArgs
              const result = []
              result.push({
                caption: `\\${commandName}{}`,
                snippet: `\\${commandName}{}`,
                meta: 'reference',
                score: 60
              })
              if (references.keys && references.keys.length > 0) {
                references.keys.forEach(function(key) {
                  if (key != null) {
                    return result.push({
                      caption: `\\${commandName}{${previousArgsCaption}${key}}`,
                      value: `\\${commandName}{${previousArgs}${key}}`,
                      meta: 'reference',
                      score: 50
                    })
                  }
                })
                return callback(null, result)
              } else {
                return callback(null, result)
              }
            }
          }
        }
      }

      return (this.editor.completers = [
        CommandCompleter,
        SnippetCompleter,
        PackageCompleter,
        ReferencesCompleter,
        LabelsCompleter,
        GraphicsCompleter,
        FilesCompleter
      ])
    }

    disable() {
      return this.editor.setOptions({
        enableBasicAutocompletion: false,
        enableSnippets: false
      })
    }

    onChange(change) {
      let i
      const cursorPosition = this.editor.getCursorPosition()
      const { end } = change
      const { lineUpToCursor, commandFragment } = Helpers.getContext(
        this.editor,
        end
      )
      if (
        (i = lineUpToCursor.indexOf('%')) > -1 &&
        lineUpToCursor[i - 1] !== '\\'
      ) {
        return
      }
      const lastCharIsBackslash = lineUpToCursor.slice(-1) === '\\'
      const lastTwoChars = lineUpToCursor.slice(-2)
      // Don't offer autocomplete on double-backslash, backslash-colon, etc
      if (/^\\[^a-zA-Z]$/.test(lastTwoChars)) {
        __guardMethod__(
          this.editor != null ? this.editor.completer : undefined,
          'detach',
          o => o.detach()
        )
        return
      }
      // Check that this change was made by us, not a collaborator
      // (Cursor is still one place behind)
      // NOTE: this is also the case when a user backspaces over a highlighted region
      if (
        change.action === 'insert' &&
        end.row === cursorPosition.row &&
        end.column === cursorPosition.column + 1
      ) {
        if (
          (commandFragment != null ? commandFragment.length : undefined) > 2 ||
          lastCharIsBackslash
        ) {
          setTimeout(() => {
            return this.editor.execCommand('startAutocomplete')
          }, 0)
        }
      }
      if (
        change.action === 'insert' &&
        /(begin|end|[a-zA-Z]*ref|usepackage|[a-z]*cite[a-z]*|input|include)/.test(
          __guard__(change.lines[0].match(/\\(\w+){}/), x => x[1])
        )
      ) {
        return setTimeout(() => {
          return this.editor.execCommand('startAutocomplete')
        }, 0)
      }
    }

    monkeyPatchAutocomplete() {
      const { Autocomplete } = ace.require('ace/autocomplete')
      const Util = ace.require('ace/autocomplete/util')
      const { editor } = this

      if (Autocomplete.prototype._insertMatch == null) {
        // Only override this once since it's global but we may create multiple
        // autocomplete handlers
        Autocomplete.prototype._insertMatch = Autocomplete.prototype.insertMatch
        Autocomplete.prototype.insertMatch = function(data) {
          const pos = editor.getCursorPosition()
          let range = new Range(pos.row, pos.column, pos.row, pos.column + 1)
          const nextChar = editor.session.getTextRange(range)

          // If we are in \begin{it|}, then we need to remove the trailing }
          // since it will be adding in with the autocomplete of \begin{item}...
          if (/^\\\w+{/.test(this.completions.filterText) && nextChar === '}') {
            editor.session.remove(range)
          }

          // Provide our own `insertMatch` implementation.
          // See the `insertMatch` method of Autocomplete in `ext-language_tools.js`.
          // We need this to account for editing existing commands, particularly when
          // adding a prefix.
          // We fix this by detecting when the cursor is in the middle of an existing
          // command, and adjusting the insertions/deletions accordingly.
          // Example:
          //   when changing `\ref{}` to `\href{}`, ace default behaviour
          //   is likely to end up with `\href{}ref{}`
          if (data == null) {
            const { completions } = this
            const { popup } = this
            data = popup.getData(popup.getRow())
            data.completer = {
              insertMatch(editor, matchData) {
                for (range of Array.from(editor.selection.getAllRanges())) {
                  const leftRange = _.clone(range)
                  const rightRange = _.clone(range)
                  // trim to left of cursor
                  const lineUpToCursor = editor
                    .getSession()
                    .getTextRange(
                      new Range(
                        range.start.row,
                        0,
                        range.start.row,
                        range.start.column
                      )
                    )
                  // Delete back to command start, as appropriate
                  const commandStartIndex = Helpers.getLastCommandFragmentIndex(
                    lineUpToCursor
                  )
                  if (commandStartIndex !== -1) {
                    leftRange.start.column = commandStartIndex
                  } else {
                    leftRange.start.column -= completions.filterText.length
                  }
                  editor.session.remove(leftRange)
                  // look at text after cursor
                  const lineBeyondCursor = editor
                    .getSession()
                    .getTextRange(
                      new Range(
                        rightRange.start.row,
                        rightRange.start.column,
                        rightRange.end.row,
                        99999
                      )
                    )

                  if (lineBeyondCursor) {
                    var partialCommandMatch
                    if (
                      (partialCommandMatch = lineBeyondCursor.match(
                        /^([a-zA-Z0-9]+)\{/
                      ))
                    ) {
                      // We've got a partial command after the cursor
                      const commandTail = partialCommandMatch[1]
                      // remove rest of the partial command, right of cursor
                      rightRange.end.column +=
                        commandTail.length - completions.filterText.length
                      editor.session.remove(rightRange)
                      // trim the completion text to just the command, without braces or brackets
                      // example: '\cite{}' -> '\cite'
                      if (matchData.snippet != null) {
                        matchData.snippet = matchData.snippet.replace(
                          /[{\[].*[}\]]/,
                          ''
                        )
                      }
                      if (matchData.caption != null) {
                        matchData.caption = matchData.caption.replace(
                          /[{\[].*[}\]]/,
                          ''
                        )
                      }
                      if (matchData.value != null) {
                        matchData.value = matchData.value.replace(
                          /[{\[].*[}\]]/,
                          ''
                        )
                      }
                    }
                  }
                }
                // finally, insert the match
                if (matchData.snippet) {
                  return aceSnippetManager.insertSnippet(
                    editor,
                    matchData.snippet
                  )
                } else {
                  return editor.execCommand(
                    'insertstring',
                    matchData.value || matchData
                  )
                }
              }
            }
          }

          return Autocomplete.prototype._insertMatch.call(this, data)
        }

        // Overwrite this to set autoInsert = false and set font size
        Autocomplete.startCommand = {
          name: 'startAutocomplete',
          exec: editor => {
            let filtered
            if (!editor.completer) {
              editor.completer = new Autocomplete()
            }
            editor.completer.autoInsert = false
            editor.completer.autoSelect = true
            editor.completer.showPopup(editor)
            editor.completer.cancelContextMenu()
            const container = $(
              editor.completer.popup != null
                ? editor.completer.popup.container
                : undefined
            )
            container.css({ 'font-size': this.$scope.fontSize + 'px' })
            // Dynamically set width of autocomplete popup
            if (
              (filtered = __guard__(
                __guard__(
                  editor != null ? editor.completer : undefined,
                  x1 => x1.completions
                ),
                x => x.filtered
              ))
            ) {
              const longestCaption = _.max(filtered.map(c => c.caption.length))
              const longestMeta = _.max(filtered.map(c => c.meta.length))
              const charWidth = editor.renderer.characterWidth
              // between 280 and 700 px
              const width = Math.max(
                Math.min(
                  Math.round(
                    longestCaption * charWidth +
                      longestMeta * charWidth +
                      5 * charWidth
                  ),
                  700
                ),
                280
              )
              container.css({ width: `${width}px` })
            }
            if (
              __guard__(
                __guard__(
                  editor.completer != null
                    ? editor.completer.completions
                    : undefined,
                  x3 => x3.filtered
                ),
                x2 => x2.length
              ) === 0
            ) {
              return editor.completer.detach()
            }
          },
          bindKey: 'Ctrl-Space|Ctrl-Shift-Space|Alt-Space'
        }
      }

      return (Util.retrievePrecedingIdentifier = function(text, pos, regex) {
        let currentLineOffset = 0
        for (
          let start = pos - 1, i = start, asc = start <= 0;
          asc ? i <= 0 : i >= 0;
          asc ? i++ : i--
        ) {
          if (text[i] === '\n') {
            currentLineOffset = i + 1
            break
          }
        }
        const currentLine = text.slice(currentLineOffset, pos)
        const fragment = Helpers.getLastCommandFragment(currentLine) || ''
        return fragment
      })
    }
  })
})

function __guardMethod__(obj, methodName, transform) {
  if (
    typeof obj !== 'undefined' &&
    obj !== null &&
    typeof obj[methodName] === 'function'
  ) {
    return transform(obj, methodName)
  } else {
    return undefined
  }
}
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
