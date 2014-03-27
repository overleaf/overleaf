define [
	"editor/Document"
	"undo/UndoManager"
	"utils/Modal"
	"ace/ace"
	"ace/edit_session"
	"ace/mode/latex"
	"ace/range"
	"ace/keyboard/vim"
	"ace/keyboard/emacs"
	"libs/backbone"
	"libs/jquery.storage"
], (Document, UndoManager, Modal) ->
	AceEditor = require("ace/ace")
	EditSession = require('ace/edit_session').EditSession
	LatexMode = require("ace/mode/latex").Mode
	Range = require("ace/range").Range
	Vim = require("ace/keyboard/vim").handler
	Emacs = require("ace/keyboard/emacs").handler
	keybindings = ace: null, vim: Vim, emacs: Emacs

	class Editor
		templates:
			editorPanel:      $("#editorPanelTemplate").html()
			loadingIndicator: $("#loadingIndicatorTemplate").html()

		viewOptions: {flatView:"flatView", splitView:"splitView"}
		currentViewState: undefined
		compilationErrors: {}

		constructor: (@ide) ->
			_.extend @, Backbone.Events
			@editorPanel = $(@templates.editorPanel)
			@ide.mainAreaManager.addArea
				identifier: "editor"
				element: @editorPanel
			@initializeEditor()
			@bindToFileTreeEvents()
			@enable()
			@loadingIndicator = $(@templates.loadingIndicator)
			@editorPanel.find("#editor").append(@loadingIndicator)
			@leftPanel = @editorPanel.find("#leftEditorPanel")
			@rightPanel = @editorPanel.find("#rightEditorPanel")
			@initSplitView()
			@switchToFlatView()

		bindToFileTreeEvents: () ->
			@ide.fileTreeManager.on "open:doc", (doc_id, options = {}) =>
				if @enabled
					@openDoc doc_id, options

		initSplitView: () ->
			splitter = @editorPanel.find("#editorSplitter")
			options =
				spacing_open: 8
				spacing_closed: 16
				east:
					size: "50%"
				maskIframesOnResize: true
				onresize: () =>
					@trigger("resize")

			if (state = $.localStorage("layout.editor"))?
				options.east = state.east

			splitter.layout options
			
			$(window).unload () =>
				@_saveSplitterState()

		_saveSplitterState: () ->
			if $("#editorSplitter").is(":visible")
				state = $("#editorSplitter").layout().readState()
				eastWidth = state.east.size + $("#editorSplitter .ui-layout-resizer-east").width()
				percentWidth = eastWidth / $("#editorSplitter").width() * 100 + "%"
				state.east.size = percentWidth
				$.localStorage("layout.editor", state)

		switchToSplitView: () ->
			if @currentViewState != @viewOptions.splitView
				@currentViewState = @viewOptions.splitView
				@leftPanel.prepend(
					@editorPanel.find("#editorWrapper")
				)
				splitter = @editorPanel.find("#editorSplitter")
				splitter.show()
				@ide.layoutManager.resizeAllSplitters()

		switchToFlatView: () ->
			if @currentViewState != @viewOptions.flatView
				@_saveSplitterState()
				@currentViewState = @viewOptions.flatView
				@editorPanel.prepend(
					@editorPanel.find("#editorWrapper")
				)
				@editorPanel.find("#editorSplitter").hide()
				@aceEditor.resize(true)

		showLoading: () ->
			delay = 600 # ms
			@loading = true
			setTimeout ( =>
				if @loading
					@loadingIndicator.show()
			), delay

		hideLoading: () ->
			@loading = false
			@loadingIndicator.hide()

		showUndoConflictWarning: () ->
			$("#editor").prepend($("#undoConflictWarning"))
			$("#undoConflictWarning").show()
			hideBtn = $("#undoConflictWarning .js-hide")
			hideBtn.off("click")
			hideBtn.on "click", (e) ->
				e.preventDefault()
				$("#undoConflictWarning").hide()
			if @hideUndoWarningTimeout?
				clearTimeout @hideUndoWarningTimeout
				delete @hideUndoWarningTimeout
			@hideUndoWarningTimeout = setTimeout ->
				$("#undoConflictWarning").fadeOut("slow")
			, 4000
				

		initializeEditor: () ->
			@aceEditor = aceEditor = AceEditor.edit("editor")

			@on "resize", => @aceEditor.resize()
			@ide.layoutManager.on "resize", => @trigger "resize"

			mode = window.userSettings.mode
			theme = window.userSettings.theme

			chosenKeyBindings = keybindings[mode]
			aceEditor.setKeyboardHandler(chosenKeyBindings)
			aceEditor.setTheme("ace/theme/#{window.userSettings.theme}")
			aceEditor.setShowPrintMargin(false)

			# Prevert Ctrl|Cmd-S from triggering save dialog
			aceEditor.commands.addCommand
				name: "save",
				bindKey: win: "Ctrl-S", mac: "Command-S"
				exec: () ->
				readOnly: true
			aceEditor.commands.removeCommand "transposeletters"
			aceEditor.commands.removeCommand "showSettingsMenu"
			aceEditor.commands.removeCommand "foldall"

			aceEditor.showCommandLine = (args...) =>
				@trigger "showCommandLine", aceEditor, args...

			aceEditor.on "dblclick", (e) => @trigger "dblclick", e
			aceEditor.on "click", (e) => @trigger "click", e
			aceEditor.on "mousemove", (e) =>
				position = @aceEditor.renderer.screenToTextCoordinates(e.clientX, e.clientY)
				e.position = position
				@trigger "mousemove", e

		setIdeToEditorPanel: (options = {}) ->
			@aceEditor.focus()
			@aceEditor.resize()
			loadDocument = =>
				@refreshCompilationErrors()

				@ide.layoutManager.resizeAllSplitters()

				if options.line?
					@gotoLine(options.line)
				else
					pos = $.localStorage("doc.position.#{@current_doc_id}") || {}
					@ignoreCursorPositionChanges = true
					@setCursorPosition(pos.cursorPosition or {row: 0, column: 0})
					@setScrollTop(pos.scrollTop or 0)
					@ignoreCursorPositionChanges = false
			@ide.mainAreaManager.change 'editor', =>
				setTimeout loadDocument, 0

		refreshCompilationErrors: () ->
			@getSession().setAnnotations @compilationErrors[@current_doc_id]
			
		openDoc: (doc_id, options = {}) ->
			if @current_doc_id == doc_id && !options.forceReopen
				@setIdeToEditorPanel(line: options.line)
			else
				@showLoading()
				@current_doc_id = doc_id
				@_openNewDocument doc_id, (error, document) =>
					if error?
						@ide.showGenericServerErrorMessage()
						return

					@setIdeToEditorPanel(line: options.line)
					@hideLoading()
					@trigger "change:doc", @getSession()

		_openNewDocument: (doc_id, callback = (error, document) ->) ->
			if @document?
				@document.leaveAndCleanUp()
				@_unbindFromDocumentEvents(@document)
				@_detachDocumentFromEditor(@document)

			@document = Document.getDocument @ide, doc_id

			@document.join (error) =>
				return callback(error) if error?
				@_bindToDocumentEvents(@document)
				@_bindDocumentToEditor(@document)
				callback null, @document

		_bindToDocumentEvents: (document) ->
			document.on "op:sent", () =>
				@ide.savingAreaManager.saving()
			document.on "op:acknowledged", () =>
				@ide.savingAreaManager.saved()

			document.on "remoteop", () =>
				@undoManager.nextUpdateIsRemote = true

			document.on "error", (error) =>
				@openDoc(document.doc_id, forceReopen: true)

				Modal.createModal
					title: "Out of sync"
					message: "Sorry, this file has gone out of sync and we need to do a full refresh. Please let us know if this happens frequently."
					buttons:[
						text: "Ok"
					]

			document.on "externalUpdate", () =>
				Modal.createModal
					title: "Document Updated Externally"
					message: "This document was just updated externally. Any recent changes you have made may have been overwritten. To see previous versions please look in the history."
					buttons:[
						text: "Ok"
					]

		_unbindFromDocumentEvents: (document) ->
			document.off()
		
		_bindDocumentToEditor: (document) ->
			$("#editor").show()
			@_bindNewDocToAce(document)

		_detachDocumentFromEditor: (document) ->
			document.detachFromAce()

		_bindNewDocToAce: (document) ->
			@_createNewSessionFromDocLines(document.getSnapshot().split("\n"))
			@_setReadWritePermission()
			@_bindToAceEvents()

			# Updating the doc can cause the cursor to jump around
			# but we shouldn't record that
			@ignoreCursorPositionChanges = true
			document.attachToAce(@aceEditor)
			@ignoreCursorPositionChanges = false

		_bindToAceEvents: () ->
			aceDoc = @getDocument()
			aceDoc.on 'change', (change) => @onDocChange(change)

			session = @getSession()
			session.on "changeScrollTop", (e) => @onScrollTopChange(e)
			session.selection.on 'changeCursor', (e) => @onCursorChange(e)

		_createNewSessionFromDocLines: (docLines) ->
			@aceEditor.setSession(new EditSession(docLines))
			session = @getSession()
			session.setUseWrapMode(true)
			session.setMode(new LatexMode())
			@undoManager = new UndoManager(@)
			session.setUndoManager @undoManager

		_setReadWritePermission: () ->
			if !@ide.isAllowedToDoIt 'readAndWrite'
				@makeReadOnly()
			else
				@makeWritable()

		onDocChange: (change) ->
			@lastUpdated = new Date()
			@trigger "update:doc", change
			
		onScrollTopChange: (event) ->
			@trigger "scroll", event
			if !@ignoreCursorPositionChanges
				docPosition = $.localStorage("doc.position.#{@current_doc_id}") || {}
				docPosition.scrollTop = @getScrollTop()
				$.localStorage("doc.position.#{@current_doc_id}", docPosition)
			
		onCursorChange: (event) ->
			if !@ignoreCursorPositionChanges
				docPosition = $.localStorage("doc.position.#{@current_doc_id}") || {}
				docPosition.cursorPosition = @getCursorPosition()
				$.localStorage("doc.position.#{@current_doc_id}", docPosition)

		makeReadOnly: () ->
			@aceEditor.setReadOnly true

		makeWritable: () ->
			@aceEditor.setReadOnly false

		getSession: () -> @aceEditor.getSession()

		getDocument: () -> @getSession().getDocument()

		gotoLine: (line) ->
			@aceEditor.gotoLine(line)

		getLines: (from, to) ->
			if from? and to?
				@getSession().doc.getLines(from, to)
			else
				@getSession().doc.getAllLines()

		addMarker: (position, klass, type, inFront) ->
			range = new Range(
				position.row, position.column,
				position.row, position.column + position.length
			)
			@getSession().addMarker range, klass, type, inFront

		removeMarker: (markerId) ->
			@getSession().removeMarker markerId

		getCursorPosition: () -> @aceEditor.getCursorPosition()
		setCursorPosition: (pos) -> @aceEditor.moveCursorToPosition(pos)

		getScrollTop: () -> @getSession().getScrollTop()
		setScrollTop: (pos) -> @getSession().setScrollTop(pos)

		replaceText: (range, text) ->
			@getSession().replace(new Range(
				range.start.row, range.start.column,
				range.end.row, range.end.column
			), text)

		getContainerElement: () ->
			$(@aceEditor.renderer.getContainerElement())

		textToEditorCoordinates: (x, y) ->
			editorAreaOffset = @getContainerElement().offset()
			{pageX, pageY} = @aceEditor.renderer.textToScreenCoordinates(x, y)
			return {
				x: pageX - editorAreaOffset.left
				y: pageY - editorAreaOffset.top
			}

		chaosMonkey: (line = 0, char = "a") ->
			@_cm = setInterval () =>
				@aceEditor.session.insert({row: line, column: 0}, char)
			, 100

		clearChaosMonkey: () ->
			clearInterval @_cm

		getCurrentDocId: () ->
			@current_doc_id

		enable: () ->
			@enabled = true

		disable: () ->
			@enabled = false
