define [
	"base"
], (App) ->

	App.factory "event_tracking", ->
		return {
			send: (category, action, label, value)->
				ga('send', 'event', category, action, label, value)
		}


	#header
	$('.navbar a').on "click", (e)->
		href = $(e.target).attr("href")
		if href?
			ga('send', 'event', 'navigation', 'top menu bar', href)

