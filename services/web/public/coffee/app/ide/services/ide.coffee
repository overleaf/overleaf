define [
	"base"
], (App) ->
	# We create and provide this as service so that we can access the global ide
	# from within other parts of the angular app.
	App.factory "ide", ["$http", ($http) ->
		ide = {}
		ide.$http = $http

		ide.pushEvent = () ->
			console.log "PUSHING EVENT STUB", arguments

		ide.reportError = () ->
			console.log "REPORTING ERROR STUB", arguments

		ide.showGenericServerErrorMessage = () ->
			console.error "GENERIC SERVER ERROR MESSAGE STUB"

		return ide
	]
