define [
	"base"
], (App) ->
	App.controller "FileTreeController", ["$scope", "$modal", "ide", "$rootScope", ($scope, $modal, ide, $rootScope) ->
		$scope.openNewDocModal = () ->
			$modal.open(
				templateUrl: "newFileModalTemplate"
				controller:  "NewFileModalController"
				size: 'lg'
				resolve: {
					parent_folder: () -> ide.fileTreeManager.getCurrentFolder()
					type: () -> 'doc'
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
				templateUrl: "newFileModalTemplate"
				controller:  "NewFileModalController"
				size: 'lg'
				resolve: {
					parent_folder: () -> ide.fileTreeManager.getCurrentFolder()
					type: () -> 'upload'
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
				ide.fileTreeManager
					.createFolder(name, $scope.parent_folder)
					.then () ->
						$scope.state.inflight = false
						$modalInstance.dismiss('done')
					.catch (response)->
						{ data } = response
						$scope.error = data
						$scope.state.inflight = false

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]

	App.controller "NewFileModalController", [
		"$scope", "type", "parent_folder", "$modalInstance"
		($scope,   type,   parent_folder,   $modalInstance) ->
			$scope.type = type
			$scope.parent_folder = parent_folder
			$scope.state = {
				inflight: false
				valid: true
			}
			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
			$scope.create = () ->
				$scope.$broadcast 'create'
			$scope.$on 'done', () ->
				$modalInstance.dismiss('done')
	]

	App.controller "NewDocModalController", [
		"$scope", "ide", "$timeout"
		($scope,   ide,   $timeout) ->
			$scope.inputs = 
				name: "name.tex"

			validate = () ->
				name = $scope.inputs.name
				$scope.state.valid = (name? and name.length > 0)
			$scope.$watch 'inputs.name', validate

			$timeout () ->
				$scope.$broadcast "open"
			, 200

			$scope.$on 'create', () ->
				name = $scope.inputs.name
				if !name? or name.length == 0
					return
				$scope.state.inflight = true
				ide.fileTreeManager
					.createDoc(name, $scope.parent_folder)
					.then () ->
						$scope.state.inflight = false
						$scope.$emit 'done'
					.catch (response)->
						{ data } = response
						$scope.error = data
						$scope.state.inflight = false

	]

	App.controller "UploadFileModalController", [
		"$scope", "$rootScope", "ide", "$timeout", "$window"
		($scope,   $rootScope,   ide,   $timeout,   $window) ->
			$scope.parent_folder_id = $scope.parent_folder?.id
			$scope.project_id = ide.project_id
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
					if response.success
						$rootScope.$broadcast 'file:upload:complete', response
					if uploadCount == 0 and response? and response.success
						$scope.$emit 'done'
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

	]

	App.controller "ProjectLinkedFileModalController", [
		"$scope", "ide", "$timeout",
		($scope,   ide,   $timeout) ->

			$scope.data =
				projects: null # or []
				selectedProjectId: null
				projectEntities: null # or []
				projectOutputFiles: null # or []
				selectedProjectEntity: null
				selectedProjectOutputFile: null
				name: null
			$scope.state.inFlight =
				projects: false
				entities: false
				compile: false
			$scope.state.isOutputFilesMode = false
			$scope.state.error = false

			$scope.$watch 'data.selectedProjectId', (newVal, oldVal) ->
				return if !newVal
				$scope.data.selectedProjectEntity = null
				$scope.data.selectedProjectOutputFile = null
				if $scope.state.isOutputFilesMode
					$scope.compileProjectAndGetOutputFiles($scope.data.selectedProjectId)
				else
					$scope.getProjectEntities($scope.data.selectedProjectId)

			$scope.$watch 'state.isOutputFilesMode', (newVal, oldVal) ->
				return if !newVal and !oldVal
				$scope.data.selectedProjectOutputFile = null
				if newVal == true
					$scope.compileProjectAndGetOutputFiles($scope.data.selectedProjectId)
				else
					$scope.getProjectEntities($scope.data.selectedProjectId)

			# auto-set filename based on selected file
			$scope.$watch 'data.selectedProjectEntity', (newVal, oldVal) ->
				return if !newVal
				fileName = newVal.split('/').reverse()[0]
				if fileName
					$scope.data.name = fileName

			# auto-set filename based on selected file
			$scope.$watch 'data.selectedProjectOutputFile', (newVal, oldVal) ->
				return if !newVal
				fileName = newVal.split('/').reverse()[0]
				if fileName
					$scope.data.name = fileName

			_setInFlight = (type) ->
				$scope.state.inFlight[type] = true

			_reset = (opts) ->
				isError = opts.err == true
				inFlight = $scope.state.inFlight
				inFlight.projects = inFlight.entities = inFlight.compile = false
				$scope.state.inflight = false
				$scope.state.error = isError

			$scope.toggleOutputFilesMode = () ->
				return if !$scope.data.selectedProjectId
				$scope.state.isOutputFilesMode = !$scope.state.isOutputFilesMode

			$scope.shouldEnableProjectSelect = () ->
				{ state, data } = $scope
				return !state.inFlight.projects && data.projects

			$scope.shouldEnableProjectEntitySelect = () ->
				{ state, data } = $scope
				return !state.inFlight.projects && !state.inFlight.entities && data.projects && data.selectedProjectId

			$scope.shouldEnableProjectOutputFileSelect = () ->
				{ state, data } = $scope
				return !state.inFlight.projects && !state.inFlight.compile && data.projects && data.selectedProjectId


			validate = () ->
				state = $scope.state
				data = $scope.data
				$scope.state.valid = !state.inFlight.projects &&
					!state.inFlight.entities &&
					data.projects &&
					data.selectedProjectId &&
					(
						(
							!$scope.state.isOutputFilesMode &&
							data.projectEntities &&
							data.selectedProjectEntity
						) ||
						(
							$scope.state.isOutputFilesMode &&
							data.projectOutputFiles &&
							data.selectedProjectOutputFile
						)
					) &&
					data.name
			$scope.$watch 'state', validate, true
			$scope.$watch 'data', validate, true

			$scope.getUserProjects = () ->
				_setInFlight('projects')
				ide.$http.get("/user/projects", {
					_csrf: window.csrfToken
				})
				.then (resp) ->
					$scope.data.projectEntities = null
					$scope.data.projects = resp.data.projects.filter (p) ->
						p._id != ide.project_id
					_reset(err: false)
				.catch (err) ->
					_reset(err: true)

			$scope.getProjectEntities = (project_id) =>
				_setInFlight('entities')
				ide.$http.get("/project/#{project_id}/entities", {
					_csrf: window.csrfToken
				})
				.then (resp) ->
					if $scope.data.selectedProjectId == resp.data.project_id
						$scope.data.projectEntities = resp.data.entities
						_reset(err: false)
				.catch (err) ->
					_reset(err: true)

			$scope.compileProjectAndGetOutputFiles = (project_id) =>
				_setInFlight('compile')
				ide.$http.post("/project/#{project_id}/compile", {
					check: "silent",
					draft: false,
					incrementalCompilesEnabled: false
					_csrf: window.csrfToken
				})
				.then (resp) ->
					if resp.data.status == 'success'
						filteredFiles = resp.data.outputFiles.filter (f) ->
							f.path.match(/.*\.(pdf|png|jpeg|jpg|gif)/)
						$scope.data.projectOutputFiles = filteredFiles
						_reset(err: false)
					else
						$scope.data.projectOutputFiles = null
						_reset(err: true)
				.catch (err) ->
					console.error(err)
					_reset(err: true)

			$scope.init = () ->
				$scope.getUserProjects()
			$timeout($scope.init, 0)

			$scope.$on 'create', () ->
				projectId = $scope.data.selectedProjectId
				name = $scope.data.name
				if $scope.state.isOutputFilesMode
					provider = 'project_output_file'
					payload = {
						source_project_id: projectId,
						source_output_file_path: $scope.data.selectedProjectOutputFile
					}
				else
					provider = 'project_file'
					payload = {
						source_project_id: projectId,
						source_entity_path: $scope.data.selectedProjectEntity
					}
				_setInFlight('create')
				ide.fileTreeManager
					.createLinkedFile(name, $scope.parent_folder, provider, payload)
					.then () ->
						_reset(err: false)
						$scope.$emit 'done'
					.catch (response)->
						{ data } = response
						_reset(err: true)


	]

	App.controller "UrlLinkedFileModalController", [
		"$scope", "ide", "$timeout"
		($scope,   ide,   $timeout) ->
			$scope.inputs =
				name: ""
				url: ""
			$scope.nameChangedByUser = false

			$timeout () ->
				$scope.$broadcast "open"
			, 200

			validate = () ->
				{name, url} = $scope.inputs
				if !name? or name.length == 0
					$scope.state.valid = false
				else if !url? or url.length == 0
					$scope.state.valid = false
				else
					$scope.state.valid = true
			$scope.$watch 'inputs.name', validate
			$scope.$watch 'inputs.url', validate

			$scope.$watch "inputs.url", (url) ->
				if url? and url != "" and !$scope.nameChangedByUser
					url = url.replace("://", "") # Ignore http:// etc
					parts = url.split("/").reverse()
					if parts.length > 1 # Wait for at one /
						$scope.inputs.name = parts[0]

			$scope.$on 'create', () ->
				{name, url} = $scope.inputs
				if !name? or name.length == 0
					return
				if !url? or url.length == 0
					return
				$scope.state.inflight = true
				ide.fileTreeManager
					.createLinkedFile(name, $scope.parent_folder, 'url', {url})
					.then () ->
						$scope.state.inflight = false
						$scope.$emit 'done'
					.catch (response)->
						{ data } = response
						$scope.error = data
						$scope.state.inflight = false

	]
