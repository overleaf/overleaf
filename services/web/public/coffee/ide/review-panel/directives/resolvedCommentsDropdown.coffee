define [
	"base"
], (App) ->
	App.directive "resolvedCommentsDropdown", () ->
		restrict: "E"
		templateUrl: "resolvedCommentsDropdownTemplate"
		scope: 
			entries: "="
			threads: "="
		link: (scope, element, attrs) ->
			scope.state = 
				isOpen: false

			scope.resolvedComments = {}

			filterResolvedComments = () ->
				scope.resolvedComments = {}

				for fileId, fileEntries of scope.entries
					scope.resolvedComments[fileId] = {}
					for entryId, entry of fileEntries
						if entry.type == "comment" and scope.threads[entry.thread_id].resolved?
							scope.resolvedComments[fileId][entryId] = scope.threads[entry.thread_id]

			scope.$watchCollection "entries", filterResolvedComments
			scope.$watchCollection "threads", filterResolvedComments

						
