define [
	"base"
	"ide/file-tree/FileTreeManager"
	"ide/connection/ConnectionManager"
	"ide/editor/EditorManager"
	"ide/online-users/OnlineUsersManager"
	"ide/history/HistoryManager"
	"ide/history/HistoryV2Manager"
	"ide/permissions/PermissionsManager"
	"ide/pdf/PdfManager"
	"ide/binary-files/BinaryFilesManager"
	"ide/references/ReferencesManager"
	"ide/metadata/MetadataManager"
	"ide/review-panel/ReviewPanelManager"
	"ide/SafariScrollPatcher"
	"ide/settings/index"
	"ide/share/index"
	"ide/chat/index"
	"ide/clone/index"
	"ide/hotkeys/index"
	"ide/test-controls/index"
	"ide/wordcount/index"
	"ide/directives/layout"
	"ide/directives/validFile"
	"ide/services/ide"
	"__IDE_CLIENTSIDE_INCLUDES__"
	"analytics/AbTestingManager"
	"directives/focus"
	"directives/fineUpload"
	"directives/scroll"
	"directives/onEnter"
	"directives/stopPropagation"
	"directives/rightClick"
	"directives/expandableTextArea"
	"directives/videoPlayState"
	"services/queued-http"
	"services/validateCaptcha"
	"services/wait-for"
	"filters/formatDate"
	"main/event"
	"main/account-upgrade"
], (
	App
	FileTreeManager
	ConnectionManager
	EditorManager
	OnlineUsersManager
	HistoryManager
	HistoryV2Manager
	PermissionsManager
	PdfManager
	BinaryFilesManager
	ReferencesManager
	MetadataManager
	ReviewPanelManager
	SafariScrollPatcher
) ->

	App.controller "IdeController", ($scope, $timeout, ide, localStorage, sixpack, event_tracking, metadata, $q) ->
		# Don't freak out if we're already in an apply callback
		$scope.$originalApply = $scope.$apply
		$scope.$apply = (fn = () ->) ->
			phase = @$root.$$phase
			if (phase == '$apply' || phase == '$digest')
				fn()
			else
				this.$originalApply(fn);

		$scope.state = {
			loading: true
			load_progress: 40
			error: null
		}
		$scope.ui = {
			leftMenuShown: false
			view: "editor"
			chatOpen: false
			pdfLayout: 'sideBySide'
			pdfHidden: false
			pdfWidth: 0
			reviewPanelOpen: localStorage("ui.reviewPanelOpen.#{window.project_id}")
			miniReviewPanelVisible: false
			chatResizerSizeOpen: window.uiConfig.chatResizerSizeOpen
			chatResizerSizeClosed: window.uiConfig.chatResizerSizeClosed
			defaultFontFamily: window.uiConfig.defaultFontFamily
			defaultLineHeight: window.uiConfig.defaultLineHeight
		}
		$scope.user = window.user

		$scope.shouldABTestPlans = false
		if $scope.user.signUpDate >= '2018-06-06'
			$scope.shouldABTestPlans = true

		$scope.settings = window.userSettings
		$scope.anonymous = window.anonymous
		$scope.isTokenMember = window.isTokenMember

		$scope.chat = {}

		ide.toggleReviewPanel = $scope.toggleReviewPanel = () ->
			if !$scope.project.features.trackChangesVisible
				return
			$scope.ui.reviewPanelOpen = !$scope.ui.reviewPanelOpen
			event_tracking.sendMB "rp-toggle-panel", { value : $scope.ui.reviewPanelOpen }

		$scope.$watch "ui.reviewPanelOpen", (value) ->
			if value?
				localStorage "ui.reviewPanelOpen.#{window.project_id}", value

		$scope.$on "layout:pdf:resize", (_, layoutState) ->
			$scope.ui.pdfHidden = layoutState.east.initClosed
			$scope.ui.pdfWidth = layoutState.east.size

		# Tracking code.
		$scope.$watch "ui.view", (newView, oldView) ->
			if newView? and newView != "editor" and newView != "pdf"
				event_tracking.sendMBOnce "ide-open-view-#{ newView }-once"

		$scope.$watch "ui.chatOpen", (isOpen) ->
			event_tracking.sendMBOnce "ide-open-chat-once" if isOpen

		$scope.$watch "ui.leftMenuShown", (isOpen) ->
			event_tracking.sendMBOnce "ide-open-left-menu-once" if isOpen

		$scope.trackHover = (feature) ->
			event_tracking.sendMBOnce "ide-hover-#{feature}-once"
		# End of tracking code.

		window._ide = ide

		ide.validFileRegex = '^[^\*\/]*$' # Don't allow * and /

		ide.project_id = $scope.project_id = window.project_id
		ide.$scope = $scope

		ide.referencesSearchManager = new ReferencesManager(ide, $scope)
		ide.connectionManager = new ConnectionManager(ide, $scope)
		ide.fileTreeManager = new FileTreeManager(ide, $scope)
		ide.editorManager = new EditorManager(ide, $scope, localStorage)
		ide.onlineUsersManager = new OnlineUsersManager(ide, $scope)
		if window.data.useV2History
			ide.historyManager = new HistoryV2Manager(ide, $scope)
		else
			ide.historyManager = new HistoryManager(ide, $scope)
		ide.pdfManager = new PdfManager(ide, $scope)
		ide.permissionsManager = new PermissionsManager(ide, $scope)
		ide.binaryFilesManager = new BinaryFilesManager(ide, $scope)
		ide.metadataManager = new MetadataManager(ide, $scope, metadata)

		inited = false
		$scope.$on "project:joined", () ->
			return if inited
			inited = true
			if $scope?.project?.deletedByExternalDataSource
				ide.showGenericMessageModal("Project Renamed or Deleted", """
					This project has either been renamed or deleted by an external data source such as Dropbox.
					We don't want to delete your data on ShareLaTeX, so this project still contains your history and collaborators.
					If the project has been renamed please look in your project list for a new project under the new name.
				""")
			$timeout(
				() ->
					if $scope.permissions.write
						ide.metadataManager.loadProjectMetaFromServer()
						_labelsInitialLoadDone = true
				, 200
			)

		# Count the first 'doc:opened' as a sign that the ide is loaded
		# and broadcast a message. This is a good event to listen for
		# if you want to wait until the ide is fully loaded and initialized
		_loaded = false
		$scope.$on 'doc:opened', () ->
			if _loaded
				return
			$scope.$broadcast('ide:loaded')
			_loaded = true

		$scope.$on 'cursor:editor:update', event_tracking.editingSessionHeartbeat

		DARK_THEMES = [
			"ambiance", "chaos", "clouds_midnight", "cobalt", "idle_fingers",
			"merbivore", "merbivore_soft", "mono_industrial", "monokai",
			"pastel_on_dark", "solarized_dark", "terminal", "tomorrow_night",
			"tomorrow_night_blue", "tomorrow_night_bright", "tomorrow_night_eighties",
			"twilight", "vibrant_ink"
		]
		$scope.darkTheme = false
		$scope.$watch "settings.editorTheme", (theme) ->
			if theme in DARK_THEMES
				$scope.darkTheme = true
			else
				$scope.darkTheme = false

		ide.localStorage = localStorage

		ide.browserIsSafari = false
		try
			userAgent = navigator.userAgent
			ide.browserIsSafari = (
				userAgent &&
				/.*Safari\/.*/.test(userAgent) &&
				!/.*Chrome\/.*/.test(userAgent) &&
				!/.*Chromium\/.*/.test(userAgent)
			)
		catch err
			console.error err

		if ide.browserIsSafari
			ide.safariScrollPatcher = new SafariScrollPatcher($scope)

		# Fix Chrome 61 and 62 text-shadow rendering
		browserIsChrome61or62 = false
		try
			chromeVersion = parseFloat(navigator.userAgent.split(" Chrome/")[1]) || null;
			browserIsChrome61or62 = (
				chromeVersion?
			)
			if browserIsChrome61or62
				document.styleSheets[0].insertRule(".ace_editor.ace_autocomplete .ace_completion-highlight { text-shadow: none !important; font-weight: bold; }", 1)
		catch err
			console.error err


		# User can append ?ft=somefeature to url to activate a feature toggle
		ide.featureToggle = location?.search?.match(/^\?ft=(\w+)$/)?[1]

		ide.socket.on 'project:publicAccessLevel:changed', (data) =>
			if data.newAccessLevel?
				ide.$scope.project.publicAccesLevel = data.newAccessLevel
				$scope.$digest()

	angular.bootstrap(document.body, ["SharelatexApp"])
