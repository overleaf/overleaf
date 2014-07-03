define [
	"base"
	"ide/file-tree/FileTreeManager"
	"ide/connection/ConnectionManager"
	"ide/editor/EditorManager"
	"ide/online-users/OnlineUsersManager"
	"ide/track-changes/TrackChangesManager"
	"ide/permissions/PermissionsManager"
	"ide/pdf/PdfManager"
	"ide/binary-files/BinaryFilesManager"
	"ide/settings/index"
	"ide/share/index"
	"ide/chat/index"
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
	OnlineUsersManager
	TrackChangesManager
	PermissionsManager
	PdfManager
	BinaryFilesManager
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
			chatOpen: false
		}
		$scope.user = window.user
		$scope.settings = window.userSettings

		$scope.chat = {}

		window._ide = ide

		ide.project_id = $scope.project_id = window.project_id
		ide.$scope = $scope

		ide.connectionManager = new ConnectionManager(ide, $scope)
		ide.fileTreeManager = new FileTreeManager(ide, $scope)
		ide.editorManager = new EditorManager(ide, $scope)
		ide.onlineUsersManager = new OnlineUsersManager(ide, $scope)
		ide.trackChangesManager = new TrackChangesManager(ide, $scope)
		ide.pdfManager = new PdfManager(ide, $scope)
		ide.permissionsManager = new PermissionsManager(ide, $scope)
		ide.binaryFilesManager = new BinaryFilesManager(ide, $scope)
	]

	angular.bootstrap(document.body, ["SharelatexApp"])