define [
	"base"
	"ide/history/util/displayNameForUser"
], (App, displayNameForUser) ->
	historyEntryController = ($scope, $element, $attrs, $filter, _) ->
		ctrl = @
		_getUserById = (id) ->
			_.find ctrl.users, (user) ->
				curUserId = user?._id or user?.id
				curUserId == id
		ctrl.displayName = displayNameForUser
		ctrl.displayNameById = (id) ->
			displayNameForUser(_getUserById(id))
		ctrl.getProjectOpDoc = (projectOp) ->
			if projectOp.rename? then "#{ projectOp.rename.pathname} → #{ projectOp.rename.newPathname }"
			else if projectOp.add? then "#{ projectOp.add.pathname}"
			else if projectOp.remove? then "#{ projectOp.remove.pathname}"
		ctrl.getUserCSSStyle = (user) ->
			hue = user?.hue or 100
			if ctrl.entry.inSelection 
				color : "#FFF" 
			else 
				color: "hsl(#{ hue }, 70%, 50%)"
		return

	App.component "historyEntry", {
		bindings:
			entry: "<"
			currentUser: "<"
			users: "<"
			onSelect: "&"
			onLabelDelete: "&"
		controller: historyEntryController
		templateUrl: "historyEntryTpl"
	}