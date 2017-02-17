define [
	"base"
], (App) ->
	app.filter "numKeys", () ->
		(object) -> Object.keys(object).length
