define [
	"ide/ConnectionManager"
	"history/HistoryManager"
	"auto-complete/AutoCompleteManager"
	"project-members/ProjectMembersManager"
	"settings/SettingsManager"
	"editor/Editor"
	"pdf/PdfManager"
	"ide/MainAreaManager"
	"ide/SideBarManager"
	"ide/TabManager"
	"ide/LayoutManager"
	"ide/FileUploadManager"
	"spelling/SpellingManager"
	"search/SearchManager"
	"models/Project"
	"models/User"
	"utils/Modal"
	"file-tree/FileTreeManager"
	"messages/MessageManager"
	"help/HelpManager"
	"cursors/CursorManager"
	"keys/HotkeysManager"
	"keys/BackspaceHighjack"
	"file-view/FileViewManager"
	"tour/IdeTour"
	"analytics/AnalyticsManager"
	"track-changes/TrackChangesManager"
	"ace/ace"
	"libs/jquery.color"
	"libs/jquery-layout"
	"libs/backbone"
	"main"
], (
	ConnectionManager,
	HistoryManager,
	AutoCompleteManager,
	ProjectMembers,
	SettingsManager,
	Editor,
	PdfManager,
	MainAreaManager,
	SideBarManager,
	TabManager,
	LayoutManager,
	FileUploadManager,
	SpellingManager,
	SearchManager,
	Project,
	User,
	Modal,
	FileTreeManager,
	MessageManager,
	HelpManager,
	CursorManager,
	HotkeysManager,
	BackspaceHighjack,
	FileViewManager,
	IdeTour,
	AnalyticsManager,
	TrackChangesManager
) ->



	ProjectMembersManager = ProjectMembers.ProjectMembersManager

	mainAreaManager = undefined
	socket = undefined
	currentDoc_id = undefined
	selectElement = undefined
	security = undefined
	_.templateSettings =
		interpolate : /\{\{(.+?)\}\}/g

	isAllowedToDoIt = (permissionsLevel)->

		if permissionsLevel == "owner" &&  _.include ["owner"], security.permissionsLevel
			return true
		else if permissionsLevel == "readAndWrite"  && _.include ["readAndWrite", "owner"], security.permissionsLevel
			return true
		else if permissionsLevel == "readOnly" && _.include ["readOnly", "readAndWrite", "owner"], security.permissionsLevel
			return true
		else
			return false

	Ide = class Ide
		constructor: () ->
			@userSettings = window.userSettings
			@project_id = @userSettings.project_id

			@user = User.findOrBuild window.user.id, window.user
			
			ide = this
			@isAllowedToDoIt = isAllowedToDoIt

			ioOptions =
				reconnect: false
				"force new connection": true
			@socket = socket = io.connect null, ioOptions

			@messageManager = new MessageManager(@)
			@connectionManager = new ConnectionManager(@)
			@tabManager = new TabManager(@)
			@layoutManager = new LayoutManager(@)
			@sideBarView = new SideBarManager(@, $("#sections"))
			selectElement = @sideBarView.selectElement
			mainAreaManager = @mainAreaManager = new MainAreaManager(@, $("#content"))
			@fileTreeManager = new FileTreeManager(@)
			@editor = new Editor(@)
			@pdfManager = new PdfManager(@)
			if @userSettings.autoComplete
				@autoCompleteManager = new AutoCompleteManager(@)
			@spellingManager = new SpellingManager(@)
			@fileUploadManager = new FileUploadManager(@)
			@searchManager = new SearchManager(@)
			@cursorManager = new CursorManager(@)
			@fileViewManager = new FileViewManager(@)
			@analyticsManager = new AnalyticsManager(@)
			if @userSettings.trackChanges
				@trackChangesManager = new TrackChangesManager(@)
			else
				@historyManager = new HistoryManager(@)

			@setLoadingMessage("Connecting")
			firstConnect = true
			socket.on "connect", () =>
				@setLoadingMessage("Joining project")
				joinProject = () =>
					socket.emit 'joinProject', {project_id: @project_id}, (err, project, permissionsLevel, protocolVersion) =>
						@hideLoadingScreen()
						if @protocolVersion? and @protocolVersion != protocolVersion
							location.reload(true)
						@protocolVersion = protocolVersion
						Security = {}
						Security.permissionsLevel = permissionsLevel
						@security = security = Object.freeze(Security)
						@project = new Project project, parse: true
						@project.set("ide", ide)						
						ide.trigger "afterJoinProject", @project

						if firstConnect
							@pdfManager.refreshPdf(isAutoCompile:true)
						firstConnect = false

				setTimeout(joinProject, 100)
	
		showErrorModal: (title, message)->
			new Modal {
				title: title
				message: message
				buttons: [ text: "OK" ]
			}

		showGenericServerErrorMessage: ()->
			new Modal {
				title: "There was a problem talking to the server"
				message: "Sorry, we couldn't complete your request right now. Please wait a few moments and try again. If the problem persists, please let us know."
				buttons: [ text: "OK" ]
			}

		reportError: (error, meta = {}) ->
			meta.client_id = @socket?.socket?.sessionid
			meta.transport = @socket?.socket?.transport?.name
			meta.client_now = new Date()
			meta.last_connected = @connectionManager.lastConnected
			meta.second_last_connected = @connectionManager.secondLastConnected
			meta.last_disconnected = @connectionManager.lastDisconnected
			meta.second_last_disconnected = @connectionManager.secondLastDisconnected
			errorObj = {}
			for key in Object.getOwnPropertyNames(error)
				errorObj[key] = error[key]
			$.ajax
				url: "/error/client"
				type: "POST"
				data: JSON.stringify
					error: errorObj
					meta: meta
				contentType: "application/json; charset=utf-8"
				headers:
					"X-Csrf-Token": window.csrfToken

		setLoadingMessage: (message) ->
			$("#loadingMessage").text(message)

		hideLoadingScreen: () ->
			$("#loadingScreen").remove()

	_.extend(Ide::, Backbone.Events)
	window.ide = ide = new Ide()
	ide.projectMembersManager = new ProjectMembersManager ide
	ide.settingsManager = new SettingsManager ide
	ide.helpManager = new HelpManager ide
	ide.hotkeysManager = new HotkeysManager ide
	ide.layoutManager.resizeAllSplitters()
	ide.tourManager = new IdeTour ide

	ide.savingAreaManager =
		$savingArea : $('#saving-area')
		timeOut: undefined
		saved:->
			@clearTimeout()
			$("#savingProblems").hide()
		saving:->
			return if @timeOut?
			@clearTimeout()
			@timeOut = setTimeout((=>
				ga?('send', 'event', 'editor-interaction', 'notification-shown', "saving")
				$("#savingProblems").show()
			), 1000)

		clearTimeout:->
			if @timeOut?
				clearTimeout @timeOut
			delete @timeOut

