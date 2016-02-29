define [
	"base"
], (App) ->
	App.controller "FileTreeController", ["$scope", "$modal", "ide", ($scope, $modal, ide) ->
		$scope.openNewDocModal = () ->
			$modal.open(
				templateUrl: "newDocModalTemplate"
				controller:  "NewDocModalController"
				resolve: {
					parent_folder: () -> ide.fileTreeManager.getCurrentFolder()
				}
			)

		$scope.openNewFolderModal = () ->
			$modal.open(
				templateUrl: "newFolderModalTemplate"
				controller:  "NewFolderModalController"
				resolve: {
					parent_folder: () -> ide.fileTreeManager.getCurrentFolder()
				}
			)

		$scope.openUploadFileModal = () ->
			$modal.open(
				templateUrl: "uploadFileModalTemplate"
				controller:  "UploadFileModalController"
				scope: $scope
				resolve: {
					parent_folder: () -> ide.fileTreeManager.getCurrentFolder()
				}
			)

		$scope.orderByFoldersFirst = (entity) ->
			return '0' if entity?.type == "folder"
			return '1'

		$scope.startRenamingSelected = () ->
			$scope.$broadcast "rename:selected"

		$scope.openDeleteModalForSelected = () ->
			$scope.$broadcast "delete:selected"
	]

	App.controller "NewDocModalController", [
		"$scope", "ide", "$modalInstance", "$timeout", "parent_folder",
		($scope,   ide,   $modalInstance,   $timeout,   parent_folder) ->
			$scope.inputs = 
				name: "name.tex"
			$scope.state =
				inflight: false

			$modalInstance.opened.then () ->
				$timeout () ->
					$scope.$broadcast "open"
				, 200

			$scope.create = () ->
				name = $scope.inputs.name
				if !name? or name.length == 0
					return
				$scope.state.inflight = true
				ide.fileTreeManager
					.createDoc(name, parent_folder)
					.success () ->
						$scope.state.inflight = false
						$modalInstance.close()

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]

	App.controller "NewFolderModalController", [
		"$scope", "ide", "$modalInstance", "$timeout", "parent_folder",
		($scope,   ide,   $modalInstance,   $timeout,   parent_folder) ->
			$scope.inputs = 
				name: "name"
			$scope.state =
				inflight: false

			$modalInstance.opened.then () ->
				$timeout () ->
					$scope.$broadcast "open"
				, 200

			$scope.create = () ->
				name = $scope.inputs.name
				if !name? or name.length == 0
					return
				$scope.state.inflight = true
				$scope.state.inflight = true
				ide.fileTreeManager
					.createFolder(name, parent_folder)
					.success () ->
						$scope.state.inflight = false
						$modalInstance.close()

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]

	App.controller "UploadFileModalController", [
		"$scope", "ide", "$modalInstance", "$timeout", "parent_folder", "$window"
		($scope,   ide,   $modalInstance,   $timeout,   parent_folder, $window) ->
			$scope.parent_folder_id = parent_folder?.id
			$scope.tooManyFiles = false
			$scope.rateLimitHit = false
			$scope.secondsToRedirect = 10
			$scope.notLoggedIn = false
			$scope.conflicts = []
			$scope.control = {}

			needToLogBackIn = ->
				$scope.notLoggedIn = true
				decreseTimeout = ->
					$timeout (() ->
						if $scope.secondsToRedirect == 0
							$window.location.href = "/login?redir=/project/#{ide.project_id}"
						else
							decreseTimeout()
							$scope.secondsToRedirect = $scope.secondsToRedirect - 1
					), 1000

				decreseTimeout()

			$scope.max_files = 40
			$scope.onComplete = (error, name, response) ->
				$timeout (() ->
					uploadCount--
					if uploadCount == 0 and response? and response.success
						$modalInstance.close("done")
				), 250

			$scope.onValidateBatch = (files)->
				if files.length > $scope.max_files
					$timeout (() ->
						$scope.tooManyFiles = true
					), 1
					return false
				else
					return true

			$scope.onError = (id, name, reason)->
				console.log(id, name, reason)
				if reason.indexOf("429") != -1
					$scope.rateLimitHit = true
				else if reason.indexOf("403") != -1
					needToLogBackIn()

			_uploadTimer = null
			uploadIfNoConflicts = () ->
				if $scope.conflicts.length == 0
					$scope.doUpload()

			uploadCount = 0
			$scope.onSubmit = (id, name) ->
				uploadCount++
				if ide.fileTreeManager.existsInFolder($scope.parent_folder_id, name)
					$scope.conflicts.push name
					$scope.$apply()
				if !_uploadTimer?
					_uploadTimer = setTimeout () ->
						_uploadTimer = null
						uploadIfNoConflicts()
					, 0
				return true
			
			$scope.onCancel = (id, name) ->
				uploadCount--
				index = $scope.conflicts.indexOf(name)
				if index > -1
					$scope.conflicts.splice(index, 1)
				$scope.$apply()
				uploadIfNoConflicts()

			$scope.doUpload = () ->
				$scope.control?.q?.uploadStoredFiles()

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]