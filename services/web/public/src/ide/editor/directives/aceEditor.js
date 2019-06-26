/* global _ */
/* eslint-disable
    camelcase,
    max-len
 */
define([
  'base',
  'ace/ace',
  'ace/ext-searchbox',
  'ace/ext-modelist',
  'ace/keybinding-vim',
  'ide/editor/directives/aceEditor/undo/UndoManager',
  'ide/editor/directives/aceEditor/auto-complete/AutoCompleteManager',
  'ide/editor/directives/aceEditor/spell-check/SpellCheckManager',
  'ide/editor/directives/aceEditor/spell-check/SpellCheckAdapter',
  'ide/editor/directives/aceEditor/highlights/HighlightsManager',
  'ide/editor/directives/aceEditor/cursor-position/CursorPositionManager',
  'ide/editor/directives/aceEditor/cursor-position/CursorPositionAdapter',
  'ide/editor/directives/aceEditor/track-changes/TrackChangesManager',
  'ide/editor/directives/aceEditor/track-changes/TrackChangesAdapter',
  'ide/editor/directives/aceEditor/metadata/MetadataManager',
  'ide/metadata/services/metadata',
  'ide/graphics/services/graphics',
  'ide/preamble/services/preamble',
  'ide/files/services/files'
], function(
  App,
  Ace,
  _ignore1,
  _ignore2,
  _ignore3,
  UndoManager,
  AutoCompleteManager,
  SpellCheckManager,
  SpellCheckAdapter,
  HighlightsManager,
  CursorPositionManager,
  CursorPositionAdapter,
  TrackChangesManager,
  TrackChangesAdapter,
  MetadataManager
) {
  let syntaxValidationEnabled
  const { EditSession } = ace.require('ace/edit_session')
  const ModeList = ace.require('ace/ext/modelist')
  const { Vim } = ace.require('ace/keyboard/vim')
  const SearchBox = ace.require('ace/ext/searchbox')

  // set the path for ace workers if using a CDN (from editor.pug)
  if (window.aceWorkerPath !== '') {
    syntaxValidationEnabled = true
    ace.config.set('workerPath', `${window.aceWorkerPath}`)
  } else {
    syntaxValidationEnabled = false
  }

  // By default, don't use workers - enable them per-session as required
  ace.config.setDefaultValue('session', 'useWorker', false)

  // Ace loads its script itself, so we need to hook in to be able to clear
  // the cache.
  if (ace.config._moduleUrl == null) {
    ace.config._moduleUrl = ace.config.moduleUrl
    ace.config.moduleUrl = function(...args) {
      const url = ace.config._moduleUrl(...Array.from(args || []))
      return url
    }
  }

  App.directive('aceEditor', function(
    $timeout,
    $compile,
    $rootScope,
    event_tracking,
    localStorage,
    $cacheFactory,
    metadata,
    graphics,
    preamble,
    files,
    $http,
    $q,
    $window
  ) {
    monkeyPatchSearch($rootScope, $compile)

    return {
      scope: {
        theme: '=',
        showPrintMargin: '=',
        keybindings: '=',
        fontSize: '=',
        autoComplete: '=',
        autoPairDelimiters: '=',
        sharejsDoc: '=',
        spellCheck: '=',
        spellCheckLanguage: '=',
        highlights: '=',
        text: '=',
        readOnly: '=',
        annotations: '=',
        navigateHighlights: '=',
        fileName: '=',
        onCtrlEnter: '=', // Compile
        onCtrlJ: '=', // Toggle the review panel
        onCtrlShiftC: '=', // Add a new comment
        onCtrlShiftA: '=', // Toggle track-changes on/off
        onSave: '=', // Cmd/Ctrl-S or :w in Vim
        syntaxValidation: '=',
        reviewPanel: '=',
        eventsBridge: '=',
        trackChanges: '=',
        docId: '=',
        rendererData: '=',
        lineHeight: '=',
        fontFamily: '='
      },
      link(scope, element, attrs) {
        // Don't freak out if we're already in an apply callback
        let spellCheckManager
        scope.$originalApply = scope.$apply
        scope.$apply = function(fn) {
          if (fn == null) {
            fn = function() {}
          }
          const phase = this.$root.$$phase
          if (phase === '$apply' || phase === '$digest') {
            return fn()
          } else {
            return this.$originalApply(fn)
          }
        }

        const editor = ace.edit(element.find('.ace-editor-body')[0])
        editor.$blockScrolling = Infinity

        // auto-insertion of braces, brackets, dollars
        editor.setOption('behavioursEnabled', scope.autoPairDelimiters || false)
        editor.setOption('wrapBehavioursEnabled', false)

        scope.$watch('autoPairDelimiters', autoPairDelimiters => {
          if (autoPairDelimiters) {
            return editor.setOption('behavioursEnabled', true)
          } else {
            return editor.setOption('behavioursEnabled', false)
          }
        })

        if (!window._debug_editors) {
          window._debug_editors = []
        }
        window._debug_editors.push(editor)

        scope.name = attrs.aceEditor

        if (scope.spellCheck) {
          // only enable spellcheck when explicitly required
          const spellCheckCache =
            $cacheFactory.get(`spellCheck-${scope.name}`) ||
            $cacheFactory(`spellCheck-${scope.name}`, { capacity: 1000 })
          spellCheckManager = new SpellCheckManager(
            scope,
            spellCheckCache,
            $http,
            $q,
            new SpellCheckAdapter(editor)
          )
        }

        /* eslint-disable no-unused-vars */
        const undoManager = new UndoManager(editor)
        const highlightsManager = new HighlightsManager(scope, editor, element)
        const cursorPositionManager = new CursorPositionManager(
          scope,
          new CursorPositionAdapter(editor),
          localStorage
        )
        const trackChangesManager = new TrackChangesManager(
          scope,
          editor,
          element,
          new TrackChangesAdapter(editor)
        )

        const metadataManager = new MetadataManager(
          scope,
          editor,
          element,
          metadata
        )
        const autoCompleteManager = new AutoCompleteManager(
          scope,
          editor,
          element,
          metadataManager,
          graphics,
          preamble,
          files
        )

        // prevent user entering null and non-BMP unicode characters in Ace
        const BAD_CHARS_REGEXP = /[\0\uD800-\uDFFF]/g
        const BAD_CHARS_REPLACEMENT_CHAR = '\uFFFD'
        // the 'exec' event fires for ace functions before they are executed.
        // you can modify the input or reject the event with e.preventDefault()
        editor.commands.on('exec', function(e) {
          // replace bad characters in paste content
          if (
            e.command &&
            e.command.name === 'paste' &&
            e.args &&
            BAD_CHARS_REGEXP.test(e.args.text)
          ) {
            e.args.text = e.args.text.replace(
              BAD_CHARS_REGEXP,
              BAD_CHARS_REPLACEMENT_CHAR
            )
          }
          // replace bad characters in keyboard input
          if (
            e.command &&
            e.command.name === 'insertstring' &&
            e.args &&
            BAD_CHARS_REGEXP.test(e.args)
          ) {
            e.args = e.args.replace(
              BAD_CHARS_REGEXP,
              BAD_CHARS_REPLACEMENT_CHAR
            )
          }
        })

        /* eslint-enable no-unused-vars */

        scope.$watch('onSave', function(callback) {
          if (callback != null) {
            Vim.defineEx('write', 'w', callback)
            editor.commands.addCommand({
              name: 'save',
              bindKey: {
                win: 'Ctrl-S',
                mac: 'Command-S'
              },
              exec: callback,
              readOnly: true
            })
            // Not technically 'save', but Ctrl-. recompiles in OL v1
            // so maintain compatibility
            return editor.commands.addCommand({
              name: 'recompile_v1',
              bindKey: {
                win: 'Ctrl-.',
                mac: 'Ctrl-.'
              },
              exec: callback,
              readOnly: true
            })
          }
        })
        editor.commands.removeCommand('transposeletters')
        editor.commands.removeCommand('showSettingsMenu')
        editor.commands.removeCommand('foldall')

        // For European keyboards, the / is above 7 so needs Shift pressing.
        // This comes through as Command-Shift-/ on OS X, which is mapped to
        // toggleBlockComment.
        // This doesn't do anything for LaTeX, so remap this to togglecomment to
        // work for European keyboards as normal.
        // On Windows, the key combo comes as Ctrl-Shift-7.
        editor.commands.removeCommand('toggleBlockComment')
        editor.commands.removeCommand('togglecomment')

        editor.commands.addCommand({
          name: 'togglecomment',
          bindKey: {
            win: 'Ctrl-/|Ctrl-Shift-7',
            mac: 'Command-/|Command-Shift-/'
          },
          exec(editor) {
            return editor.toggleCommentLines()
          },
          multiSelectAction: 'forEachLine',
          scrollIntoView: 'selectionPart'
        })

        // Trigger search AND replace on CMD+F
        editor.commands.addCommand({
          name: 'find',
          bindKey: {
            win: 'Ctrl-F',
            mac: 'Command-F'
          },
          exec(editor) {
            return SearchBox.Search(editor, true)
          },
          readOnly: true
        })

        // Bold text on CMD+B
        editor.commands.addCommand({
          name: 'bold',
          bindKey: {
            win: 'Ctrl-B',
            mac: 'Command-B'
          },
          exec(editor) {
            const selection = editor.getSelection()
            if (selection.isEmpty()) {
              editor.insert('\\textbf{}')
              return editor.navigateLeft(1)
            } else {
              const text = editor.getCopyText()
              return editor.insert(`\\textbf{${text}}`)
            }
          },
          readOnly: false
        })

        // Italicise text on CMD+I
        editor.commands.addCommand({
          name: 'italics',
          bindKey: {
            win: 'Ctrl-I',
            mac: 'Command-I'
          },
          exec(editor) {
            const selection = editor.getSelection()
            if (selection.isEmpty()) {
              editor.insert('\\textit{}')
              return editor.navigateLeft(1)
            } else {
              const text = editor.getCopyText()
              return editor.insert(`\\textit{${text}}`)
            }
          },
          readOnly: false
        })

        scope.$watch('onCtrlEnter', function(callback) {
          if (callback != null) {
            return editor.commands.addCommand({
              name: 'compile',
              bindKey: {
                win: 'Ctrl-Enter',
                mac: 'Command-Enter'
              },
              exec: editor => {
                return callback()
              },
              readOnly: true
            })
          }
        })

        scope.$watch('onCtrlJ', function(callback) {
          if (callback != null) {
            return editor.commands.addCommand({
              name: 'toggle-review-panel',
              bindKey: {
                win: 'Ctrl-J',
                mac: 'Command-J'
              },
              exec: editor => {
                return callback()
              },
              readOnly: true
            })
          }
        })

        scope.$watch('onCtrlShiftC', function(callback) {
          if (callback != null) {
            return editor.commands.addCommand({
              name: 'add-new-comment',
              bindKey: {
                win: 'Ctrl-Shift-C',
                mac: 'Command-Shift-C'
              },
              exec: editor => {
                return callback()
              },
              readOnly: true
            })
          }
        })

        scope.$watch('onCtrlShiftA', function(callback) {
          if (callback != null) {
            return editor.commands.addCommand({
              name: 'toggle-track-changes',
              bindKey: {
                win: 'Ctrl-Shift-A',
                mac: 'Command-Shift-A'
              },
              exec: editor => {
                return callback()
              },
              readOnly: true
            })
          }
        })

        // Make '/' work for search in vim mode.
        editor.showCommandLine = arg => {
          if (arg === '/') {
            return SearchBox.Search(editor, true)
          }
        }

        const getCursorScreenPosition = function() {
          const session = editor.getSession()
          const cursorPosition = session.selection.getCursor()
          const sessionPos = session.documentToScreenPosition(
            cursorPosition.row,
            cursorPosition.column
          )
          return (
            sessionPos.row * editor.renderer.lineHeight - session.getScrollTop()
          )
        }

        if (attrs.resizeOn != null) {
          for (let event of Array.from(attrs.resizeOn.split(','))) {
            scope.$on(event, function() {
              scope.$applyAsync(() => {
                const previousScreenPosition = getCursorScreenPosition()
                editor.resize()
                // Put cursor back to same vertical position on screen
                const newScreenPosition = getCursorScreenPosition()
                const session = editor.getSession()
                return session.setScrollTop(
                  session.getScrollTop() +
                    newScreenPosition -
                    previousScreenPosition
                )
              })
            })
          }
        }

        scope.$on(`${scope.name}:set-scroll-size`, function(e, size) {
          // Make sure that the editor has enough scroll margin above and below
          // to scroll the review panel with the given size
          const marginTop = size.overflowTop
          const { maxHeight } = editor.renderer.layerConfig
          const marginBottom = Math.max(size.height - maxHeight, 0)
          return setScrollMargins(marginTop, marginBottom)
        })

        var setScrollMargins = function(marginTop, marginBottom) {
          let marginChanged = false
          if (editor.renderer.scrollMargin.top !== marginTop) {
            editor.renderer.scrollMargin.top = marginTop
            marginChanged = true
          }
          if (editor.renderer.scrollMargin.bottom !== marginBottom) {
            editor.renderer.scrollMargin.bottom = marginBottom
            marginChanged = true
          }
          if (marginChanged) {
            return editor.renderer.updateFull()
          }
        }

        const resetScrollMargins = () => setScrollMargins(0, 0)

        scope.$watch('theme', value => editor.setTheme(`ace/theme/${value}`))

        scope.$watch('showPrintMargin', value =>
          editor.setShowPrintMargin(value)
        )

        scope.$watch('keybindings', function(value) {
          if (['vim', 'emacs'].includes(value)) {
            return editor.setKeyboardHandler(`ace/keyboard/${value}`)
          } else {
            return editor.setKeyboardHandler(null)
          }
        })

        scope.$watch('fontSize', value =>
          element.find('.ace_editor, .ace_content').css({
            'font-size': value + 'px'
          })
        )

        scope.$watch('fontFamily', function(value) {
          const monospaceFamilies = [
            'Monaco',
            'Menlo',
            'Ubuntu Mono',
            'Consolas',
            'source-code-pro',
            'monospace'
          ]

          if (value != null) {
            switch (value) {
              case 'monaco':
                return editor.setOption(
                  'fontFamily',
                  monospaceFamilies.join(', ')
                )
              case 'lucida':
                return editor.setOption(
                  'fontFamily',
                  '"Lucida Console", monospace'
                )
              default:
                return editor.setOption('fontFamily', null)
            }
          }
        })

        scope.$watch('lineHeight', function(value) {
          if (value != null) {
            switch (value) {
              case 'compact':
                editor.container.style.lineHeight = 1.33
                break
              case 'normal':
                editor.container.style.lineHeight = 1.6
                break
              case 'wide':
                editor.container.style.lineHeight = 2
                break
              default:
                editor.container.style.lineHeight = 1.6
            }
            return editor.renderer.updateFontSize()
          }
        })

        scope.$watch('sharejsDoc', function(sharejs_doc, old_sharejs_doc) {
          if (old_sharejs_doc != null) {
            scope.$broadcast('beforeChangeDocument')
            detachFromAce(old_sharejs_doc)
          }
          if (sharejs_doc != null) {
            attachToAce(sharejs_doc)
          }
          if (sharejs_doc != null && old_sharejs_doc != null) {
            return scope.$broadcast('afterChangeDocument')
          }
        })

        scope.$watch('text', function(text) {
          if (text != null) {
            editor.setValue(text, -1)
            const session = editor.getSession()
            return session.setUseWrapMode(true)
          }
        })

        scope.$watch('annotations', function(annotations) {
          const session = editor.getSession()
          return session.setAnnotations(annotations)
        })

        scope.$watch('readOnly', value => editor.setReadOnly(!!value))

        scope.$watch('syntaxValidation', function(value) {
          // ignore undefined settings here
          // only instances of ace with an explicit value should set useWorker
          // the history instance will have syntaxValidation undefined
          if (value != null && syntaxValidationEnabled) {
            const session = editor.getSession()
            return session.setOption('useWorker', value)
          }
        })

        editor.setOption('scrollPastEnd', true)

        let updateCount = 0
        const onChange = function() {
          updateCount++

          if (updateCount === 100) {
            event_tracking.send('editor-interaction', 'multi-doc-update')
          }
          return scope.$emit(`${scope.name}:change`)
        }

        const onScroll = function(scrollTop) {
          if (scope.eventsBridge == null) {
            return
          }
          const height = editor.renderer.layerConfig.maxHeight
          return scope.eventsBridge.emit('aceScroll', scrollTop, height)
        }

        const onScrollbarVisibilityChanged = function(event, vRenderer) {
          if (scope.eventsBridge == null) {
            return
          }
          return scope.eventsBridge.emit(
            'aceScrollbarVisibilityChanged',
            vRenderer.scrollBarV.isVisible,
            vRenderer.scrollBarV.width
          )
        }

        if (scope.eventsBridge != null) {
          editor.renderer.on(
            'scrollbarVisibilityChanged',
            onScrollbarVisibilityChanged
          )

          scope.eventsBridge.on('externalScroll', position =>
            editor.getSession().setScrollTop(position)
          )
          scope.eventsBridge.on('refreshScrollPosition', function() {
            const session = editor.getSession()
            session.setScrollTop(session.getScrollTop() + 1)
            return session.setScrollTop(session.getScrollTop() - 1)
          })
        }

        const onSessionChangeForSpellCheck = function(e) {
          spellCheckManager.onSessionChange()
          if (e.oldSession != null) {
            e.oldSession.getDocument().off('change', spellCheckManager.onChange)
          }
          e.session.getDocument().on('change', spellCheckManager.onChange)
          if (e.oldSession != null) {
            e.oldSession.off('changeScrollTop', spellCheckManager.onScroll)
          }
          return e.session.on('changeScrollTop', spellCheckManager.onScroll)
        }

        const initSpellCheck = function() {
          if (!spellCheckManager) return
          spellCheckManager.init()
          editor.on('changeSession', onSessionChangeForSpellCheck)
          onSessionChangeForSpellCheck({
            session: editor.getSession()
          }) // Force initial setup
          return editor.on('nativecontextmenu', spellCheckManager.onContextMenu)
        }

        const tearDownSpellCheck = function() {
          if (!spellCheckManager) return
          editor.off('changeSession', onSessionChangeForSpellCheck)
          return editor.off(
            'nativecontextmenu',
            spellCheckManager.onContextMenu
          )
        }

        const initTrackChanges = function() {
          trackChangesManager.rangesTracker = scope.sharejsDoc.ranges

          // Force onChangeSession in order to set up highlights etc.
          trackChangesManager.onChangeSession()

          if (!trackChangesManager) return
          editor.on('changeSelection', trackChangesManager.onChangeSelection)

          // Selection also moves with updates elsewhere in the document
          editor.on('change', trackChangesManager.onChangeSelection)

          editor.on('changeSession', trackChangesManager.onChangeSession)
          editor.on('cut', trackChangesManager.onCut)
          editor.on('paste', trackChangesManager.onPaste)
          editor.renderer.on('resize', trackChangesManager.onResize)
        }

        const tearDownTrackChanges = function() {
          if (!trackChangesManager) return
          this.trackChangesManager.tearDown()
          editor.off('changeSelection', trackChangesManager.onChangeSelection)

          editor.off('change', trackChangesManager.onChangeSelection)
          editor.off('changeSession', trackChangesManager.onChangeSession)
          editor.off('cut', trackChangesManager.onCut)
          editor.off('paste', trackChangesManager.onPaste)
          editor.renderer.off('resize', trackChangesManager.onResize)
        }

        const initUndo = function() {
          // Emulate onChangeSession event. Note: listening to changeSession
          // event is unnecessary since this method is called when we switch
          // sessions (via ShareJS changing) anyway
          undoManager.onChangeSession(editor.getSession())
          editor.on('change', undoManager.onChange)
        }

        const tearDownUndo = function() {
          editor.off('change', undoManager.onChange)
        }

        const onSessionChangeForCursorPosition = function(e) {
          if (e.oldSession != null) {
            e.oldSession.selection.off(
              'changeCursor',
              cursorPositionManager.onCursorChange
            )
          }
          return e.session.selection.on(
            'changeCursor',
            cursorPositionManager.onCursorChange
          )
        }

        const onUnloadForCursorPosition = () =>
          cursorPositionManager.onUnload(editor.getSession())

        const initCursorPosition = function() {
          editor.on('changeSession', onSessionChangeForCursorPosition)

          // Force initial setup
          onSessionChangeForCursorPosition({ session: editor.getSession() })

          return $(window).on('unload', onUnloadForCursorPosition)
        }

        const tearDownCursorPosition = function() {
          editor.off('changeSession', onSessionChangeForCursorPosition)
          return $(window).off('unload', onUnloadForCursorPosition)
        }

        initCursorPosition()

        // Trigger the event once *only* - this is called after Ace is connected
        // to the ShareJs instance but this event should only be triggered the
        // first time the editor is opened. Not every time the docs opened
        const triggerEditorInitEvent = _.once(() =>
          scope.$broadcast('editorInit')
        )

        var attachToAce = function(sharejs_doc) {
          let mode
          const lines = sharejs_doc.getSnapshot().split('\n')
          let session = editor.getSession()
          if (session != null) {
            session.destroy()
          }

          // see if we can lookup a suitable mode from ace
          // but fall back to text by default
          try {
            if (/\.(Rtex|bbl|tikz)$/i.test(scope.fileName)) {
              // recognise Rtex and bbl as latex
              mode = 'ace/mode/latex'
            } else if (/\.(sty|cls|clo)$/.test(scope.fileName)) {
              // recognise some common files as tex
              mode = 'ace/mode/tex'
            } else {
              ;({ mode } = ModeList.getModeForPath(scope.fileName))
              // we prefer plain_text mode over text mode because ace's
              // text mode is actually for code and has unwanted
              // indenting (see wrapMethod in ace edit_session.js)
              if (mode === 'ace/mode/text') {
                mode = 'ace/mode/plain_text'
              }
            }
          } catch (error) {
            mode = 'ace/mode/plain_text'
          }

          // create our new session
          session = new EditSession(lines, mode)

          session.setUseWrapMode(true)
          // use syntax validation only when explicitly set
          if (
            scope.syntaxValidation != null &&
            syntaxValidationEnabled &&
            !/\.bib$/.test(scope.fileName)
          ) {
            session.setOption('useWorker', scope.syntaxValidation)
          }

          // set to readonly until document change handlers are attached
          editor.setReadOnly(true)

          // now attach session to editor
          editor.setSession(session)

          const doc = session.getDocument()
          doc.on('change', onChange)

          editor.initing = true
          sharejs_doc.attachToAce(editor)
          editor.initing = false

          // now ready to edit document
          // respect the readOnly setting, normally false
          editor.setReadOnly(scope.readOnly)
          triggerEditorInitEvent()

          if (!scope.readOnly) {
            initSpellCheck()
          }

          initTrackChanges()
          initUndo()

          resetScrollMargins()

          // need to set annotations after attaching because attaching
          // deletes and then inserts document content
          session.setAnnotations(scope.annotations)

          session.on('changeScrollTop', event_tracking.editingSessionHeartbeat)

          angular
            .element($window)
            .on('click', event_tracking.editingSessionHeartbeat)

          scope.$on('$destroy', () =>
            angular
              .element($window)
              .off('click', event_tracking.editingSessionHeartbeat)
          )

          if (scope.eventsBridge != null) {
            session.on('changeScrollTop', onScroll)
          }

          $rootScope.hasLintingError = false
          session.on('changeAnnotation', function() {
            // Both linter errors and compile logs are set as error annotations,
            // however when the user types something, the compile logs are
            // replaced with linter errors. When we check for lint errors before
            // autocompile we are guaranteed to get linter errors
            const hasErrors =
              session
                .getAnnotations()
                .filter(annotation => annotation.type !== 'info').length > 0

            if ($rootScope.hasLintingError !== hasErrors) {
              return ($rootScope.hasLintingError = hasErrors)
            }
          })

          setTimeout(() =>
            // Let any listeners init themselves
            onScroll(editor.renderer.getScrollTop())
          )

          return editor.focus()
        }

        var detachFromAce = function(sharejs_doc) {
          tearDownSpellCheck()
          tearDownTrackChanges()
          tearDownUndo()
          sharejs_doc.detachFromAce()
          sharejs_doc.off('remoteop.recordRemote')

          const session = editor.getSession()
          session.off('changeScrollTop')

          const doc = session.getDocument()
          return doc.off('change', onChange)
        }

        if (scope.rendererData != null) {
          editor.renderer.on('changeCharacterSize', () => {
            scope.$apply(
              () => (scope.rendererData.lineHeight = editor.renderer.lineHeight)
            )
          })
        }

        scope.$watch('rendererData', function(rendererData) {
          if (rendererData != null) {
            return (rendererData.lineHeight = editor.renderer.lineHeight)
          }
        })

        scope.$on('$destroy', function() {
          if (scope.sharejsDoc != null) {
            scope.$broadcast('changeEditor')
            tearDownSpellCheck()
            tearDownCursorPosition()
            tearDownUndo()
            detachFromAce(scope.sharejsDoc)
            const session = editor.getSession()
            if (session != null) {
              session.destroy()
            }
            return scope.eventsBridge.emit(
              'aceScrollbarVisibilityChanged',
              false,
              0
            )
          }
        })

        return scope.$emit(`${scope.name}:inited`, editor)
      },

      template: `\
<div class="ace-editor-wrapper">
	<div
		class="undo-conflict-warning alert alert-danger small"
		ng-show="undo.show_remote_warning"
	>
		<strong>Watch out!</strong>
		We had to undo some of your collaborators changes before we could undo yours.
		<a
			href="#"
			class="pull-right"
			ng-click="undo.show_remote_warning = false"
		>Dismiss</a>
	</div>
	<div class="ace-editor-body"></div>
	<spell-menu
		open="spellMenu.open"
		top="spellMenu.top"
		left="spellMenu.left"
		layout-from-bottom="spellMenu.layoutFromBottom"
		highlight="spellMenu.highlight"
		replace-word="replaceWord(highlight, suggestion)"
		learn-word="learnWord(highlight)"
	></spell-menu>
	<div
		class="annotation-label"
		ng-show="annotationLabel.show"
		ng-style="{
			position: 'absolute',
			left:     annotationLabel.left,
			right:    annotationLabel.right,
			bottom:   annotationLabel.bottom,
			top:      annotationLabel.top,
			'background-color': annotationLabel.backgroundColor
		}"
	>
		{{ annotationLabel.text }}
	</div>

	<a
		href
		class="highlights-before-label btn btn-info btn-xs"
		ng-show="updateLabels.highlightsBefore > 0"
		ng-click="gotoHighlightAbove()"
	>
		<i class="fa fa-fw fa-arrow-up"></i>
		{{ updateLabels.highlightsBefore }} more update{{ updateLabels.highlightsBefore > 1 && "" || "s" }} above
	</a>

	<a
		href
		class="highlights-after-label btn btn-info btn-xs"
		ng-show="updateLabels.highlightsAfter > 0"
		ng-click="gotoHighlightBelow()"
	>
		<i class="fa fa-fw fa-arrow-down"></i>
		{{ updateLabels.highlightsAfter }} more update{{ updateLabels.highlightsAfter > 1 && "" || "s" }} below

	</a>
</div>\
`
    }
  })

  function monkeyPatchSearch($rootScope, $compile) {
    const searchHtml = `\
<div class="ace_search right">
	<a href type="button" action="hide" class="ace_searchbtn_close">
		<i class="fa fa-fw fa-times"></i>
	</a>
	<div class="ace_search_form">
		<input class="ace_search_field form-control input-sm" placeholder="Search for" spellcheck="false"></input>
		<div class="btn-group">
			<button type="button" action="findNext" class="ace_searchbtn next btn btn-default btn-sm">
				<i class="fa fa-chevron-down fa-fw"></i>
			</button>
			<button type="button" action="findPrev" class="ace_searchbtn prev btn btn-default btn-sm">
				<i class="fa fa-chevron-up fa-fw"></i>
			</button>
		</div>
	</div>
	<div class="ace_replace_form">
		<input class="ace_search_field form-control input-sm" placeholder="Replace with" spellcheck="false"></input>
		<div class="btn-group">
			<button type="button" action="replaceAndFindNext" class="ace_replacebtn btn btn-default btn-sm">Replace</button>
			<button type="button" action="replaceAll" class="ace_replacebtn btn btn-default btn-sm">All</button>
		</div>
	</div>
	<div class="ace_search_options">
		<div class="btn-group">
			<button action="toggleRegexpMode" class="btn btn-default btn-sm" tooltip-placement="bottom" tooltip-append-to-body="true" tooltip="RegExp Search">.*</button>
			<button action="toggleCaseSensitive" class="btn btn-default btn-sm" tooltip-placement="bottom" tooltip-append-to-body="true" tooltip="CaseSensitive Search">Aa</button>
			<button action="toggleWholeWords" class="btn btn-default btn-sm" tooltip-placement="bottom" tooltip-append-to-body="true" tooltip="Whole Word Search">"..."</button>
			<button action="searchInSelection" class="btn btn-default btn-sm" tooltip-placement="bottom" tooltip-append-to-body="true" tooltip="Search Within Selection"><i class="fa fa-align-left"></i></button>
		</div>
		<span class="ace_search_counter"></span>
	</div>
	<div action="toggleReplace" class="hidden"></div>
</div>\
`

    // Remove Ace CSS
    $('#ace_searchbox').remove()

    const SB = SearchBox.SearchBox
    const { $init } = SB.prototype
    SB.prototype.$init = function() {
      this.element = $compile(searchHtml)($rootScope.$new())[0]
      return $init.apply(this)
    }
  }
})
