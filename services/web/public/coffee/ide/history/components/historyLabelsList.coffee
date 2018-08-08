define [
	"base"
	"ide/history/util/displayNameForUser"
], (App, displayNameForUser) ->
	historyLabelsListController = ($scope, $element, $attrs) ->
		ctrl = @ 
		# This method (and maybe the one below) will be removed soon. User details data will be 
		# injected into the history API responses, so we won't need to fetch user data from other
		# local data structures.
		_getUserById = (id) ->
			_.find ctrl.users, (user) ->
				curUserId = user?._id or user?.id
				curUserId == id
		ctrl.displayName = displayNameForUser
		ctrl.displayNameById = (id) ->
			displayNameForUser(_getUserById(id))
		return

	App.component "historyLabelsList", {
		bindings:
			labels: "<"
			users: "<"
			isLoading: "<"
			currentUser: "<"
			onLabelSelect: "&"
			onLabelDelete: "&"
		controller: historyLabelsListController
		templateUrl: "historyLabelsListTpl"
	}
