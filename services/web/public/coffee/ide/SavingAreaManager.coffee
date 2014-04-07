define [
], () ->
	class SavingAreaManager
		$el: $('#saving-area')

		constructor: (@ide) ->
			@unsavedSeconds = 0
			setInterval () =>
				@pollSavedStatus()
			, 1000

			$(window).bind 'beforeunload', () =>
				@warnAboutUnsavedChanges()

		pollSavedStatus: () ->
			saved = @ide.editor.document.pollSavedStatus()
			if saved
				@unsavedSeconds = 0
			else
				@unsavedSeconds += 1

			if @unsavedSeconds >= 4
				$("#savingProblems").text("Saving... (#{@unsavedSeconds} seconds of unsaved changes)")
				$("#savingProblems").show()
			else
				$("#savingProblems").hide()

		warnAboutUnsavedChanges: () ->
			if @ide.editor.hasUnsavedChanges()
				return "You have unsaved changes. If you leave now they will not be saved."
