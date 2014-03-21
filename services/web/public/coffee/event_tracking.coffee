require [
], ()->
	#plans page
	$('a.sign_up_now').on 'click', (e)->
		ga_PlanType = $(@).attr("ga_PlanType")
		ga 'send', 'event', 'subscription-funnel', 'sign_up_now_button', ga_PlanType

	$('#annual-pricing').on 'click', ->
		ga 'send', 'event', 'subscription-funnel', 'plans-page', 'annual-prices'
	$('#student-pricing').on 'click', ->
		ga('send', 'event',  'subscription-funnel', 'plans-page', 'student-prices')

	$('#plansLink').on 'click', ->
		ga 'send', 'event', 'subscription-funnel', 'go-to-plans-page', 'from menu bar'



