define [
	"libs/bootstrap/bootstrap2full"
	"forms"
], ()->
	$(document).ready ()->
		mixpanel?.track_links(".signup-now", "homepage.signup-now")
		$('#registerButton').click ->
			 mixpanel?.track("homepage.register-now")
