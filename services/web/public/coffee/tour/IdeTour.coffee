
define [
	"libs/intro"
	"utils/Modal"
	"libs/jquery.storage"
], (introJs, Modal, storage)->

	key = "tour.hadIntroduction"

	saveTourHasBeenFinished = ->
		$.localStorage(key, true)

	getIfTourHasStarted = ->
		return $.localStorage(key)

	class IdeTour
		template: $("#editorTourTemplate").html()

		constructor: (@ide) ->
			@ide.on "afterJoinProject", () =>
				if !@inited
					@inited = true
					signUpDate = new Date(@ide.user.get("signUpDate")).getTime()
					oneDay = 24 * 60 * 60 * 1000
					yesterday = new Date().getTime() - oneDay

					signedUpToday = signUpDate > yesterday

					hadIntroduction = getIfTourHasStarted()

					if !hadIntroduction? and signedUpToday
						@run()

					@$el = $(@template)
					$("#toolbar-footer").append(@$el)
					@$el.on "click", (e) =>
						e.preventDefault()
						@run()

		run : ->
			$('#code-tab-li a').click()

			intro = introJs()
			intro.oncomplete saveTourHasBeenFinished
			intro.onexit saveTourHasBeenFinished

			isSplitView = $('#recompilePdf').is(":visible")

			if isSplitView
				pdfStep =
					element: '#pdfToolBar'
					intro: "Compile your project, check logs, download and change editor layout."
			else
				pdfStep =
					element: "li#pdf"
					intro: "Compile and preview your project."

			chatIsMinimized = $('.chat-window.minimized').is(":visible")
			if chatIsMinimized
				$('.js-minimize-toggle.minimize-toggle').click()


			steps = [
				{
					element: '.actions'
					intro: "<h4>Welcome to ShareLaTeX!</h4> You can add, upload, rename and delete your documents here."
				},
				pdfStep,
				{
					element: '#history-tab-li'
					intro: "View what has changed in your project."
					position: 'right'
				}, {
					element: '#collaborators-tab-li'
					intro: "Add collaborators and share your project."
					position: 'right'
				}, {
					element: '#settings-tab-li'
					intro: "Change your project settings."
					position: 'right'
				}, {
					element: '.chat-window'
					intro: "Chat to your collaborators."
					position: 'top'
				}
			]

			intro.setOptions(skipLabel: "Skip tour", steps:steps, showStepNumbers:false)

			intro.start()


