define [
	"base"
], (App) ->
	App.directive "resolvedCommentsDropdown", () ->
		restrict: "E"
		templateUrl: "resolvedCommentsDropdownTemplate"
		scope: 
			entries 	: "="
			threads 	: "="
			docs		: "="
			onOpen		: "&"
			onUnresolve	: "&"
			onDelete	: "&"
			isLoading	: "="

		link: (scope, element, attrs) ->
			scope.state = 
				isOpen: false

			scope.toggleOpenState = () ->
				scope.state.isOpen = !scope.state.isOpen
				if (scope.state.isOpen)
					filterResolvedComments()
					scope.onOpen()

			scope.resolvedCommentsPerFile = {}

			scope.handleUnresolve = (threadId) ->
				scope.onUnresolve({ threadId })
				filterResolvedComments()

			scope.handleDelete = (entryId, threadId) ->
				scope.onDelete({ entryId, threadId })
				filterResolvedComments()


			filterResolvedComments = () ->
				scope.resolvedCommentsPerFile = {}

				for fileId, fileEntries of scope.entries
					scope.resolvedCommentsPerFile[fileId] = {}
					for entryId, entry of fileEntries
						if entry.type == "comment" and scope.threads[entry.thread_id]?.resolved?
							scope.resolvedCommentsPerFile[fileId][entryId] = angular.copy scope.threads[entry.thread_id]
							scope.resolvedCommentsPerFile[fileId][entryId].content = entry.content
							scope.resolvedCommentsPerFile[fileId][entryId].threadId = entry.thread_id
							scope.resolvedCommentsPerFile[fileId][entryId].entryId = entryId

			scope.$watchCollection "entries", filterResolvedComments
			scope.$watchCollection "threads", filterResolvedComments

						
