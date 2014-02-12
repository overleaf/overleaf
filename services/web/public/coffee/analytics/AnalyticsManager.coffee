define () ->
	class AnalyticsManager
		constructor: (@ide) ->
			@ide.editor.on "update:doc", () =>
				@updateCount ||= 0
				@updateCount++
				if @updateCount == 100
					mixpanel?.track("Updated doc multiple times in one session", project_id: @ide.project.id)

			@ide.pdfManager.on "compile:pdf", () =>
				@compileCount ||= 0
				@compileCount++
				if @compileCount == 1
					mixpanel?.track("Compiled project at least once in one session", project_id: @ide.project.id)
				if @compileCount == 3
					mixpanel?.track("Compiled project multiple times in one session", project_id: @ide.project.id)
