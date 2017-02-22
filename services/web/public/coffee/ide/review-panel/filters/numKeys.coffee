define [
	"base"
], (App) ->
	app.filter "numKeys", () ->
		(object) -> 
			if object?
				return Object.keys(object).length
			else
				return 0
