angular.module("localStorage", [])
	.value "localStorage", (args...) ->
		###
		localStorage can throw browser exceptions, for example if it is full
		We don't use localStorage for anything critical, on in that case just
		fail gracefully.
		###
		try
			return $.localStorage args...
		catch e
			console.error "localStorage exception", e
			return null