define [
	"base"
	"ace/ace"
	"ide/editor/directives/aceEditor/undo/UndoManager"
	"ide/editor/directives/aceEditor/auto-complete/AutoCompleteManager"
	"ide/editor/directives/aceEditor/spell-check/SpellCheckManager"
	"ide/editor/directives/aceEditor/highlights/HighlightsManager"
	"ide/editor/directives/aceEditor/cursor-position/CursorPositionManager"
	"ace/keyboard/vim"
	"ace/keyboard/emacs"
	"ace/mode/latex"
	"ace/edit_session"
], (App, Ace, UndoManager, AutoCompleteManager, SpellCheckManager, HighlightsManager, CursorPositionManager) ->
	LatexMode = require("ace/mode/latex").Mode
	EditSession = require('ace/edit_session').EditSession

	App.directive "aceEditor", ["$timeout", ($timeout) ->
		return  {
			scope: {
				theme: "="
				showPrintMargin: "="
				keybindings: "="
				fontSize: "="
				autoComplete: "="
				sharejsDoc: "="
				lastUpdated: "="
				spellCheckLanguage: "="
				cursorPosition: "="
				highlights: "="
				text: "="
				readOnly: "="
				gotoLine: "="
				annotations: "="
			}
			link: (scope, element, attrs) ->
				# Don't freak out if we're already in an apply callback
				scope.$originalApply = scope.$apply
				scope.$apply = (fn = () ->) ->
					phase = @$root.$$phase
					if (phase == '$apply' || phase == '$digest')
						fn()
					else
						@$originalApply(fn);

				editor = Ace.edit(element.find(".ace-editor-body")[0])
				window.editors ||= []
				window.editors.push editor

				autoCompleteManager   = new AutoCompleteManager(scope, editor, element)
				spellCheckManager     = new SpellCheckManager(scope, editor, element)
				undoManager           = new UndoManager(scope, editor, element)
				highlightsManager     = new HighlightsManager(scope, editor, element)
				cursorPositionManager = new CursorPositionManager(scope, editor, element)

				# Prevert Ctrl|Cmd-S from triggering save dialog
				editor.commands.addCommand
					name: "save",
					bindKey: win: "Ctrl-S", mac: "Command-S"
					exec: () ->
					readOnly: true
				editor.commands.removeCommand "transposeletters"
				editor.commands.removeCommand "showSettingsMenu"
				editor.commands.removeCommand "foldall"

				if attrs.resizeOn?
					for event in attrs.resizeOn.split(",")
						scope.$on event, () ->
							editor.resize()

				scope.$watch "theme", (value) ->
					editor.setTheme("ace/theme/#{value}")

				scope.$watch "showPrintMargin", (value) ->
					editor.setShowPrintMargin(value)

				scope.$watch "keybindings", (value) ->
					Vim = require("ace/keyboard/vim").handler
					Emacs = require("ace/keyboard/emacs").handler
					keybindings = vim: Vim, emacs: Emacs
					editor.setKeyboardHandler(keybindings[value])

				scope.$watch "fontSize", (value) ->
					element.find(".ace_editor, .ace_content").css({
						"font-size": value + "px"
					})

				scope.$watch "sharejsDoc", (sharejs_doc, old_sharejs_doc) ->
					if old_sharejs_doc?
						detachFromAce(old_sharejs_doc)

					if sharejs_doc?
						attachToAce(sharejs_doc)

				scope.$watch "text", (text) ->
					if text?
						editor.setValue(text, -1)
						session = editor.getSession()
						session.setUseWrapMode(true)
						session.setMode(new LatexMode())

				scope.$watch "annotations", (annotations) ->
					if annotations?
						session = editor.getSession() 
						session.setAnnotations annotations

				scope.$watch "readOnly", (value) ->
					editor.setReadOnly !!value

				resetSession = () ->
					session = editor.getSession()
					session.setUseWrapMode(true)
					session.setMode(new LatexMode())
					session.setAnnotations scope.annotations

				attachToAce = (sharejs_doc) ->
					lines = sharejs_doc.getSnapshot().split("\n") 
					editor.setSession(new EditSession(lines))
					resetSession()
					session = editor.getSession()

					doc = session.getDocument()
					doc.on "change", () ->
						scope.$apply () ->
							scope.lastUpdated = new Date()

					sharejs_doc.on "remoteop.recordForUndo", () =>
						undoManager.nextUpdateIsRemote = true

					sharejs_doc.attachToAce(editor)

					editor.focus()

				detachFromAce = (sharejs_doc) ->
					sharejs_doc.detachFromAce()
					sharejs_doc.off "remoteop.recordForUndo"

			template: """
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
					<div 
						id="spellCheckMenu"
						class="dropdown context-menu"
						ng-show="spellingMenu.open"
						ng-style="{top: spellingMenu.top, left: spellingMenu.left}"
						ng-class="{open: spellingMenu.open}"
					>
						<ul class="dropdown-menu">
							<li ng-repeat="suggestion in spellingMenu.highlight.suggestions | limitTo:8">
								<a href ng-click="replaceWord(spellingMenu.highlight, suggestion)">{{ suggestion }}</a>
							</li>
							<li class="divider"></li>
							<li>
								<a href ng-click="learnWord(spellingMenu.highlight)">Add to Dictionary</a>
							</li>
						</ul>
					</div>
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
				</div>
			"""
		}
	]