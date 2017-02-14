define [
	"base"
], (App) ->
	App.directive "commentEntry", ($timeout) ->
		restrict: "E"
		templateUrl: "commentEntryTemplate"
		scope: 
			entry: "="
			threads: "="
			permissions: "="
			onResolve: "&"
			onReply: "&"
			onIndicatorClick: "&"
			onSaveEdit: "&"
			onDelete: "&"
			onBodyClick: "&"
		link: (scope, element, attrs) ->
			scope.state =
				animating: false

			element.on "click", (e) ->
				if $(e.target).is('.rp-entry, .rp-comment-loaded, .rp-comment-content, .rp-comment-reply, .rp-entry-metadata')
					scope.onBodyClick()

			scope.handleCommentReplyKeyPress = (ev) ->
				if ev.keyCode == 13 and !ev.shiftKey and !ev.ctrlKey and !ev.metaKey
					ev.preventDefault()
					if scope.entry.replyContent.length > 0 
						ev.target.blur()
						scope.onReply()
			
			scope.animateAndCallOnResolve = () ->
				scope.state.animating = true
				element.find(".rp-entry").css("top", 0)
				$timeout((() -> scope.onResolve()), 350)
				return true
			
			scope.startEditing = (comment) ->
				comment.editing = true
				setTimeout () ->
					scope.$emit "review-panel:layout"
			
			scope.saveEdit = (comment) ->
				comment.editing = false
				scope.onSaveEdit({comment:comment})
			
			scope.confirmDelete = (comment) ->
				comment.deleting = true
				setTimeout () ->
					scope.$emit "review-panel:layout"
				
			scope.cancelDelete = (comment) ->
				comment.deleting = false
				setTimeout () ->
					scope.$emit "review-panel:layout"
			
			scope.doDelete = (comment) ->
				comment.deleting = false
				scope.onDelete({comment: comment})
	
			scope.saveEditOnEnter = (ev, comment) ->
				if ev.keyCode == 13 and !ev.shiftKey and !ev.ctrlKey and !ev.metaKey
					ev.preventDefault()
					scope.saveEdit(comment)
				