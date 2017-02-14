define [
	"base"
], (App) ->
	app.filter 'notEmpty', () ->
		(object) -> !angular.equals({}, object)
