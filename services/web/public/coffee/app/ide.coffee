define [
	"base"
	"ide/file-tree/FileTreeManager"
	"ide/connection/ConnectionManager"
	"ide/editor/EditorManager"
	"ide/settings/SettingsManager"
	"ide/online-users/OnlineUsersManager"
	"ide/track-changes/TrackChangesManager"
	"ide/pdf/PdfManager"
	"ide/share/index"
	"ide/directives/layout"
	"ide/services/ide"
	"directives/focus"
	"directives/fineUpload"
	"directives/onEnter"
	"filters/formatDate"
], (
	App
	FileTreeManager
	ConnectionManager
	EditorManager
	SettingsManager
	OnlineUsersManager
	TrackChangesManager
	PdfManager
) ->
	App.controller "IdeController", ["$scope", "$timeout", "ide", ($scope, $timeout, ide) ->
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
		}
		$scope.ui = {
			leftMenuShown: false
			view: "editor"
		}
		$scope.user = window.user

		window._ide = ide

		ide.project_id = $scope.project_id = window.project_id
		ide.$scope = $scope

		ide.connectionManager = new ConnectionManager(ide, $scope)
		ide.fileTreeManager = new FileTreeManager(ide, $scope)
		ide.editorManager = new EditorManager(ide, $scope)
		ide.settingsManager = new SettingsManager(ide, $scope)
		ide.onlineUsersManager = new OnlineUsersManager(ide, $scope)
		ide.trackChangesManager = new TrackChangesManager(ide, $scope)
		ide.pdfManager = new PdfManager(ide, $scope)
	]

	angular.bootstrap(document.body, ["SharelatexApp"])