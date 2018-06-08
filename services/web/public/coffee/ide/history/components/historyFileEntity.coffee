define [
	"base"
	"ide/file-tree/util/iconTypeFromName"
], (App, iconTypeFromName) ->
	# TODO Add arrows in folders
	historyFileEntityController = ($scope, $element, $attrs) ->
		ctrl = @
		_handleFolderClick = () ->
			ctrl.isOpen = !ctrl.isOpen
			ctrl.iconClass = _getFolderIcon()
		_handleFileClick = () ->
			ctrl.historyFileTreeController.handleEntityClick ctrl.fileEntity
		_getFolderIcon = () ->
			if ctrl.isOpen then "fa-folder-open" else "fa-folder"
		ctrl.$onInit = () ->
			if ctrl.fileEntity.type == "folder"
				ctrl.isOpen = true
				ctrl.iconClass = _getFolderIcon()
				ctrl.handleClick = _handleFolderClick
			else
				ctrl.iconClass = "fa-#{ iconTypeFromName(ctrl.fileEntity.name) }"
				ctrl.handleClick = _handleFileClick
				$scope.$watch (() -> ctrl.historyFileTreeController.selectedPathname), (newPathname) ->
					ctrl.isSelected = ctrl.fileEntity.pathname == newPathname
		return

	App.component "historyFileEntity", {
		require: 
			historyFileTreeController: "^historyFileTree"
		bindings:
			fileEntity: "<"
		controller: historyFileEntityController
		templateUrl: "historyFileEntityTpl"
	}