require [
	"libs/bootstrap/bootstrap2full"
], ()->
	#plans page
	$('a.sign_up_now').on 'click', ->
		ga 'send', 'event', 'button', 'click', 'premium-sign-up'
	$('#annual-pricing').on 'click', ->
		ga 'send', 'event', 'button', 'click', 'student-prices'

	$('#student-pricing').on 'click', ->
		ga('send', 'event', 'button', 'click', 'student-prices')

	#plans link
	$('#plansLink').on 'click', ->
		ga 'send', 'event', 'button', 'click', 'plans-link-menu-bar' 
