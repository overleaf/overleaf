define [
	"base"
], (App) ->
	App.filter "orderOverviewEntries", () ->
		(items) ->
			array = []
			for key, value of items
				value.entry_id = key
				array.push value
			array.sort (a, b) -> a.offset - b.offset
			return array
