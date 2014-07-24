define [
	"base"
	"ace/ace"
	"ace/ext-searchbox"
	"ide/editor/directives/aceEditor/undo/UndoManager"
	"ide/editor/directives/aceEditor/auto-complete/AutoCompleteManager"
	"ide/editor/directives/aceEditor/spell-check/SpellCheckManager"
	"ide/editor/directives/aceEditor/highlights/HighlightsManager"
	"ide/editor/directives/aceEditor/cursor-position/CursorPositionManager"
], (App, Ace, SearchBox, UndoManager, AutoCompleteManager, SpellCheckManager, HighlightsManager, CursorPositionManager) ->
	EditSession = ace.require('ace/edit_session').EditSession
	
	# Ace loads its script itself, so we need to hook in to be able to clear
	# the cache.
	if !ace.config._moduleUrl?
		ace.config._moduleUrl = ace.config.moduleUrl
		ace.config.moduleUrl = (args...) ->
			url = ace.config._moduleUrl(args...) + "?fingerprint=#{window.aceFingerprint}"
			return url

	App.directive "aceEditor", ($timeout, $compile, $rootScope, event_tracking) ->
		monkeyPatchSearch($rootScope, $compile)

		return  {
			scope: {
				theme: "="
				showPrintMargin: "="
				keybindings: "="
				fontSize: "="
				autoComplete: "="
				sharejsDoc: "="
				spellCheckLanguage: "="
				highlights: "="
				text: "="
				readOnly: "="
				annotations: "="
				navigateHighlights: "=",
				onCtrlEnter: "="
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

				editor = ace.edit(element.find(".ace-editor-body")[0])
				window.editors ||= []
				window.editors.push editor

				scope.name = attrs.aceEditor

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

				# Trigger search AND replace on CMD+F
				editor.commands.addCommand
					name: "find",
					bindKey: win: "Ctrl-F", mac: "Command-F"
					exec: (editor) ->
						ace.require("ace/ext/searchbox").Search(editor, true)
					readOnly: true
				editor.commands.removeCommand "replace"
				
				scope.$watch "onCtrlEnter", (callback) ->
					if callback?
						editor.commands.addCommand 
							name: "compile",
							bindKey: win: "Ctrl-Enter", mac: "Command-Enter"
							exec: (editor) =>
								callback()
							readOnly: true

				# Make '/' work for search in vim mode.
				editor.showCommandLine = (arg) =>
					if arg == "/"
						ace.require("ace/ext/searchbox").Search(editor, true)

				if attrs.resizeOn?
					for event in attrs.resizeOn.split(",")
						scope.$on event, () ->
							editor.resize()

				scope.$watch "theme", (value) ->
					editor.setTheme("ace/theme/#{value}")

				scope.$watch "showPrintMargin", (value) ->
					editor.setShowPrintMargin(value)

				scope.$watch "keybindings", (value) ->
					if value in ["vim", "emacs"]
						editor.setKeyboardHandler("ace/keyboard/#{value}")
					else
						editor.setKeyboardHandler(null)

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
						session.setMode("ace/mode/latex")

				scope.$watch "annotations", (annotations) ->
					if annotations?
						session = editor.getSession()
						session.setAnnotations annotations

				scope.$watch "readOnly", (value) ->
					editor.setReadOnly !!value

				resetSession = () ->
					session = editor.getSession()
					session.setUseWrapMode(true)
					session.setMode("ace/mode/latex")
					session.setAnnotations scope.annotations

				updateCount = 0
				onChange = () ->
					updateCount++
					if updateCount == 100
						event_tracking.send 'editor-interaction', 'multi-doc-update'
					scope.$emit "#{scope.name}:change"

				attachToAce = (sharejs_doc) ->
					lines = sharejs_doc.getSnapshot().split("\n")
					editor.setSession(new EditSession(lines))
					resetSession()
					session = editor.getSession()

					doc = session.getDocument()
					doc.on "change", onChange

					sharejs_doc.on "remoteop.recordForUndo", () =>
						undoManager.nextUpdateIsRemote = true

					sharejs_doc.attachToAce(editor)

					editor.focus()

				detachFromAce = (sharejs_doc) ->
					sharejs_doc.detachFromAce()
					sharejs_doc.off "remoteop.recordForUndo"

					session = editor.getSession()
					doc = session.getDocument()
					doc.off "change", onChange

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
				</div>
			"""
		}

	monkeyPatchSearch = ($rootScope, $compile) ->
		SearchBox = ace.require("ace/ext/searchbox").SearchBox
		searchHtml = """
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
						<span action="toggleRegexpMode" class="btn btn-default btn-sm" tooltip-placement="bottom" tooltip-append-to-body="true" tooltip="RegExp Search">.*</span>
						<span action="toggleCaseSensitive" class="btn btn-default btn-sm" tooltip-placement="bottom" tooltip-append-to-body="true" tooltip="CaseSensitive Search">Aa</span>
						<span action="toggleWholeWords" class="btn btn-default btn-sm" tooltip-placement="bottom" tooltip-append-to-body="true" tooltip="Whole Word Search">"..."</span>
					</div>
				</div>
			</div>
		"""

		# Remove Ace CSS
		$("#ace_searchbox").remove()

		$init = SearchBox::$init
		SearchBox::$init = () ->
			@element = $compile(searchHtml)($rootScope.$new())[0];
			$init.apply(@)
