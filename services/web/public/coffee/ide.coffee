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
	StandaloneModal,
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
			if @userSettings.longPolling
				ioOptions.transports = ["xhr-polling"]
			@socket = socket = io.connect null, ioOptions

			@messageManager = new MessageManager(@)
			@connectionManager = new ConnectionManager(@)
			@tabManager = new TabManager(@)
			@layoutManager = new LayoutManager(@)
			@sideBarView = new SideBarManager(@, $("#sections"))
			selectElement = @sideBarView.selectElement
			mainAreaManager = @mainAreaManager = new MainAreaManager(@, $("#content"))
			@editor = new Editor(@)
			@pdfManager = new PdfManager(@)
			if @userSettings.autoComplete
				@autoCompleteManager = new AutoCompleteManager(@)
			@spellingManager = new SpellingManager(@)
			@fileTreeManager = new FileTreeManager(@)
			@fileUploadManager = new FileUploadManager(@)
			@searchManager = new SearchManager(@)
			@cursorManager = new CursorManager(@)
			@fileViewManager = new FileViewManager(@)
			@analyticsManager = new AnalyticsManager(@)
			@trackChangesManager = new TrackChangesManager(@)

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
			modalOptions =
				templateId:'genericModalTemplate'
				isStatic: false
				title: title
				message:message
			new Modal modalOptions

		showGenericServerErrorMessage: (message)->
			new Modal
				templateId : "genericServerErrorModal"

		setLoadingMessage: (message) ->
			$("#loadingMessage").text(message)

		hideLoadingScreen: () ->
			$("#loadingScreen").remove()

	_.extend(Ide::, Backbone.Events)
	window.ide = ide = new Ide()
	ide.historyManager = new HistoryManager ide
	ide.projectMembersManager = new ProjectMembersManager ide
	ide.settingsManager = new SettingsManager ide
	ide.helpManager = new HelpManager ide
	ide.hotkeysManager = new HotkeysManager ide
	ide.layoutManager.resizeAllSplitters()
	ide.tourManager = new IdeTour ide

	class Modal
		#templateId, title, message, isStatic, cancelCallback
		constructor: (options, completeCallback = () -> {})->
			html = $("##{options.templateId}").html()
			modal = "<div id='modal' style='display:none'>#{html}</div>"
			$('body').append(modal)
			$modal = $('#modal')

			if options.title?
				$modal.find('h3').text(options.title)
			if options.message?
				$modal.find('.message').text(options.message)
			if options.inputValue?
				$modal.find('input').val(options.inputValue)

			backdrop = true
			if options.backdrop?
				backdrop = options.backdrop

			$modal.modal backdrop:backdrop, show:true, keyboard:true, isStatic:options.isStatic
			$modal.find('input').focus()

			$modal.find('button').click (e)=>
				e.preventDefault()
				$modal.modal('hide')
				if e.target.className.indexOf("cancel") == -1
					inputval = $modal.find('input').val()
					completeCallback(inputval)

			$modal.find('input').keydown (event)=>
				code = event.keyCode || event.which
				if code == 13
					$modal.find('button.primary').click()

			$modal.bind 'hide', ()->
				if options.cancelCallback?
					options.cancelCallback()
				$('#modal').remove()

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
				ga('send', 'event', 'editor-interaction', 'notification-shown', "saving")
				$("#savingProblems").show()
			), 1000)

		clearTimeout:->
			if @timeOut?
				clearTimeout @timeOut
			delete @timeOut

