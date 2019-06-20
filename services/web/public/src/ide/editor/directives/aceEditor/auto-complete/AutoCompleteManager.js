/* global _ */
define([
  'ide/editor/directives/aceEditor/auto-complete/CommandManager',
  'ide/editor/directives/aceEditor/auto-complete/EnvironmentManager',
  'ide/editor/directives/aceEditor/auto-complete/PackageManager',
  'ide/editor/directives/aceEditor/auto-complete/Helpers',
  'ace/ace',
  'ace/ext-language_tools'
], function(CommandManager, EnvironmentManager, PackageManager, Helpers) {
  const { Range } = ace.require('ace/range')
  const aceSnippetManager = ace.require('ace/snippets').snippetManager

  class AutoCompleteManager {
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
          this.enable()
        } else {
          this.disable()
        }
      })

      const onChange = change => {
        this.onChange(change)
      }

      this.editor.on('changeSession', e => {
        e.oldSession.off('change', onChange)
        e.session.on('change', onChange)
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
              // eslint-disable-next-line no-unused-vars
              let commandName = match[1]
              const graphicsPaths = Preamble.getGraphicsPaths()
              const result = []
              for (let graphic of Graphics.getGraphicsFiles()) {
                let { path } = graphic
                for (let graphicsPath of graphicsPaths) {
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
              callback(null, result)
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
              // eslint-disable-next-line no-unused-vars
              const commandName = match[1]
              const result = []
              for (let file of Files.getTeXFiles()) {
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
              callback(null, result)
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
              // eslint-disable-next-line no-unused-vars
              const commandName = refMatch[1]
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
              for (let label of metadataManager.getAllLabels()) {
                result.push({
                  caption: `\\${commandName}{${label}}`,
                  value: `\\${commandName}{${label}}`,
                  meta: 'cross-reference',
                  score: 50
                })
              }
              callback(null, result)
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
              // eslint-disable-next-line no-unused-vars
              let [_ignore, commandName, previousArgs] = citeMatch
              if (previousArgs == null) {
                previousArgs = ''
              }
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
                    result.push({
                      caption: `\\${commandName}{${previousArgs}${key}}`,
                      value: `\\${commandName}{${previousArgs}${key}}`,
                      meta: 'reference',
                      score: 50
                    })
                  }
                })
                callback(null, result)
              } else {
                callback(null, result)
              }
            }
          }
        }
      }

      this.editor.completers = [
        CommandCompleter,
        SnippetCompleter,
        PackageCompleter,
        ReferencesCompleter,
        LabelsCompleter,
        GraphicsCompleter,
        FilesCompleter
      ]
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
        if (this.editor.completer) {
          this.editor.completer.detach()
        }
        return
      }
      // Check that this change was made by us, not a collaborator
      // (Cursor is still one place behind)
      // NOTE: this is also the case when a user backspaces over a highlighted
      // region
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
            this.editor.execCommand('startAutocomplete')
          }, 0)
        }
      }
      const match = change.lines[0].match(/\\(\w+){}/)
      if (
        change.action === 'insert' &&
        (match && match[1]) &&
        // eslint-disable-next-line max-len
        /(begin|end|[a-zA-Z]*ref|usepackage|[a-z]*cite[a-z]*|input|include)/.test(
          match[1]
        )
      ) {
        return setTimeout(() => {
          this.editor.execCommand('startAutocomplete')
        }, 0)
      }
    }

    monkeyPatchAutocomplete() {
      const { Autocomplete } = ace.require('ace/autocomplete')
      const Util = ace.require('ace/autocomplete/util')

      if (Autocomplete.prototype._insertMatch == null) {
        // Only override this once since it's global but we may create multiple
        // autocomplete handlers
        Autocomplete.prototype._insertMatch = Autocomplete.prototype.insertMatch
        Autocomplete.prototype.insertMatch = function(data) {
          const { editor } = this

          const pos = editor.getCursorPosition()
          let range = new Range(pos.row, pos.column, pos.row, pos.column + 1)
          const nextChar = editor.session.getTextRange(range)
          // If we are in \begin{it|}, then we need to remove the trailing }
          // since it will be adding in with the autocomplete of \begin{item}...
          if (
            /^\\\w+(\[[\w\\,=. ]*\])?{/.test(this.completions.filterText) &&
            nextChar === '}'
          ) {
            editor.session.remove(range)
          }

          // Provide our own `insertMatch` implementation.
          // See the `insertMatch` method of Autocomplete in
          // `ext-language_tools.js`.
          // We need this to account for editing existing commands, particularly
          // when adding a prefix.
          // We fix this by detecting when the cursor is in the middle of an
          // existing command, and adjusting the insertions/deletions
          // accordingly.
          // Example:
          //   when changing `\ref{}` to `\href{}`, ace default behaviour
          //   is likely to end up with `\href{}ref{}`
          if (data == null) {
            const { completions } = this
            const { popup } = this
            data = popup.getData(popup.getRow())
            data.completer = {
              insertMatch(editor, matchData) {
                for (range of editor.selection.getAllRanges()) {
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
                    const partialCommandMatch = lineBeyondCursor.match(
                      /^([a-zA-Z0-9]+)\{/
                    )
                    if (partialCommandMatch) {
                      // We've got a partial command after the cursor
                      const commandTail = partialCommandMatch[1]
                      // remove rest of the partial command, right of cursor
                      rightRange.end.column +=
                        commandTail.length - completions.filterText.length
                      editor.session.remove(rightRange)
                      // trim the completion text to just the command, without
                      // braces or brackets
                      // example: '\cite{}' -> '\cite'
                      if (matchData.snippet != null) {
                        matchData.snippet = matchData.snippet.replace(
                          /[{[].*[}\]]/,
                          ''
                        )
                      }
                      if (matchData.caption != null) {
                        matchData.caption = matchData.caption.replace(
                          /[{[].*[}\]]/,
                          ''
                        )
                      }
                      if (matchData.value != null) {
                        matchData.value = matchData.value.replace(
                          /[{[].*[}\]]/,
                          ''
                        )
                      }
                    }
                    const inArgument = lineBeyondCursor.match(
                      /^([\w._-]+)\}(.*)/
                    )
                    if (inArgument) {
                      const argumentRightOfCursor = inArgument[1]
                      const afterArgument = inArgument[2]
                      if (afterArgument) {
                        rightRange.end.column =
                          rightRange.start.column +
                          argumentRightOfCursor.length +
                          1
                      }
                      editor.session.remove(rightRange)
                    }
                  }
                }
                // finally, insert the match
                if (matchData.snippet) {
                  aceSnippetManager.insertSnippet(editor, matchData.snippet)
                } else {
                  editor.execCommand(
                    'insertstring',
                    matchData.value || matchData
                  )
                }
              }
            }
          }

          Autocomplete.prototype._insertMatch.call(this, data)
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
            filtered =
              editor.completer.completions &&
              editor.completer.completions.filtered
            if (filtered) {
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
            if (filtered.length === 0) {
              editor.completer.detach()
            }
          },
          bindKey: 'Ctrl-Space|Ctrl-Shift-Space|Alt-Space'
        }
      }

      Util.retrievePrecedingIdentifier = function(text, pos, regex) {
        let currentLineOffset = 0
        for (let i = pos - 1; i <= 0; i++) {
          if (text[i] === '\n') {
            currentLineOffset = i + 1
            break
          }
        }
        const currentLine = text.slice(currentLineOffset, pos)
        const fragment = Helpers.getLastCommandFragment(currentLine) || ''
        return fragment
      }
    }
  }

  return AutoCompleteManager
})
