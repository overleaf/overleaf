define ->
	formatDate = (date) ->
		date = new Date(date) unless date instanceof Date
		delta = (new Date() - date) / 1000.0
		seconds = 1
		minutes = 60*seconds
		hours = 60*minutes
		days = 24*hours
		if (delta < 30*seconds)
			"just now"
		else if (delta < 2*minutes)
			"a minute ago"
		else if (delta < 1*hours)
			Math.floor(delta / minutes) + " minutes ago"
		else if (delta < 2*hours)
			"an hour ago"
		else if (delta < 1*days)
			Math.floor(delta / hours) + " hours ago"
		else
			hours = date.getHours()
			hours = "0" + hours if hours < 10
			minutes = date.getMinutes()
			minutes = "0" + minutes if minutes < 10
			hours + ":" + minutes + " " + date.toLocaleDateString()
	
	return {
		formatDate : formatDate
	}
