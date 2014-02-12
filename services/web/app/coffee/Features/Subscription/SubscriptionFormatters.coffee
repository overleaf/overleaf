dateformat = require 'dateformat'

module.exports =

	formatPrice: (priceInCents) ->
		string = priceInCents + ""
		string = "0" + string if string.length == 2
		string = "00" + string if string.length == 1
		string = "000" if string.length == 0
		cents = string.slice(-2)
		dollars = string.slice(0, -2)
		return "$#{dollars}.#{cents}"

	formatDate: (date) ->
		dateformat date, "dS mmmm yyyy"