define [
	"base"
], (App) ->
	moment.lang "en", calendar:
		lastDay : '[Yesterday]'
		sameDay : '[Today]'
		nextDay : '[Tomorrow]'
		lastWeek : "ddd, Do MMM YY"
		nextWeek : "ddd, Do MMM YY"
		sameElse : 'ddd, Do MMM YY'

	App.filter "formatDate", () ->
		(date, format = "Do MMM YYYY, h:mm a") ->
			moment(date).format(format)

	App.filter "relativeDate", () ->
		(date) ->
			moment(date).calendar()