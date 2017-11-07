define [
	"base"
], (App) ->
	App.controller "OnlineUsersController", ($scope, ide) ->
		$scope.gotoUser = (user) ->
			if user.doc? and user.row?
				ide.editorManager.openDoc(user.doc, gotoLine: user.row + 1)

		$scope.userInitial = (user) ->
			if user.user_id == 'anonymous-user'
				'?'
			else
				user.name.slice(0, 1)
