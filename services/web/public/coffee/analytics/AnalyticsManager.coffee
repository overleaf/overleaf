define () ->
	class AnalyticsManager
		constructor: (@ide) ->
			@ide.editor.on "update:doc", () =>
				@updateCount ||= 0
				@updateCount++
				if @updateCount == 100
					ga('send', 'event', 'editor-interaction', 'multi-doc-update')

			@ide.pdfManager.on "compile:pdf", () =>
				@compileCount ||= 0
				@compileCount++
				if @compileCount == 1
					ga('send', 'event', 'editor-interaction', 'single-compile')
				if @compileCount == 3
					ga('send', 'event', 'editor-interaction', 'multi-compile')
