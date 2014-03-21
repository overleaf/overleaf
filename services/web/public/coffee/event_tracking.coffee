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


	#list page
	$('#newProject a').on 'click', (e)->
		ga 'send', 'event', 'project-list-page-interaction', 'new-project', $(@).text().trim()

	$('#projectFilter').on 'keydown', (e)->
		ga 'send', 'event', 'project-list-page-interaction', 'project-search', 'keydown'

	$('#projectList .project-actions li a').on 'click', (e)->
		ga 'send', 'event', 'project-list-page-interaction', 'project action', $(@).text().trim()



	#left menu navigation

	$('.tab-link.account-settings-tab').on 'click', ->
		ga 'send', 'event', 'navigation', 'left menu bar', 'user settings link'

	$('.tab-link.subscription-tab').on 'click', ->
		ga 'send', 'event', 'navigation', 'left menu bar', 'subscription managment link'



	#menu bar navigation

	$('.userSettingsLink').on 'click', ->
		ga 'send', 'event', 'navigation', 'top menu bar', 'user settings link'

	$('.subscriptionLink').on 'click', ->
		ga 'send', 'event', 'navigation', 'top menu bar', 'subscription managment link'

	$('.logoutLink').on 'click', ->
		ga 'send', 'event', 'navigation', 'top menu bar', 'logout'

	$('#templatesLink').on 'click', ->
		ga 'send', 'event', 'navigation', 'top menu bar', 'templates'

	$('#blogLink').on 'click', ->
		ga 'send', 'event', 'navigation', 'top menu bar', 'blog'

	$('#learnLink').on 'click', ->
		ga 'send', 'event', 'navigation', 'top menu bar', 'learn link'

	$('#resourcesLink').on 'click', ->
		ga 'send', 'event', 'navigation', 'top menu bar', 'resources link'

	$('#aboutUsLink').on 'click', ->
		ga 'send', 'event', 'navigation', 'top menu bar', 'about us link'

	# editor

	$('#hotkeysLink').on 'click', ->
		ga 'send', 'event', 'navigation', 'editor', 'show hot keys link'

	$('#editorTourLink').on 'click', ->
		ga 'send', 'event', 'navigation', 'editor', 'editor tour link'
