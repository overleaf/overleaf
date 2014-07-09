define [], () ->
	class CursorPositionManager
		constructor: (@$scope, @editor, @element) ->

			@editor.on "changeSession", (e) =>
				if e.oldSession?
					@storeCursorPosition(e.oldSession)
					@storeScrollTopPosition(e.oldSession)

				@doc_id = @$scope.sharejsDoc?.doc_id

				e.session.selection.on 'changeCursor', (e) =>
					@emitCursorUpdateEvent(e)

				setTimeout () =>
					@gotoStoredPosition()
				, 0

			$(window).on "unload", () =>
				@storeCursorPosition(@editor.getSession())
				@storeScrollTopPosition(@editor.getSession())

			@$scope.$on "#{@$scope.name}:gotoLine", (editor, value) =>
				if value?
					setTimeout () =>
						@gotoLine(value)
					, 0

		storeScrollTopPosition: (session) ->
			if @doc_id?
				docPosition = $.localStorage("doc.position.#{@doc_id}") || {}
				docPosition.scrollTop = session.getScrollTop()
				$.localStorage("doc.position.#{@doc_id}", docPosition)

		storeCursorPosition: (session) ->
			if @doc_id?
				docPosition = $.localStorage("doc.position.#{@doc_id}") || {}
				docPosition.cursorPosition = session.selection.getCursor()
				$.localStorage("doc.position.#{@doc_id}", docPosition)
			
		emitCursorUpdateEvent: () ->
			cursor = @editor.getCursorPosition()
			@$scope.$emit "cursor:#{@$scope.name}:update", cursor

		gotoStoredPosition: () ->
			return if !@doc_id?
			pos = $.localStorage("doc.position.#{@doc_id}") || {}
			@ignoreCursorPositionChanges = true
			@editor.moveCursorToPosition(pos.cursorPosition or {row: 0, column: 0})
			@editor.getSession().setScrollTop(pos.scrollTop or 0)
			delete @ignoreCursorPositionChanges

		gotoLine: (line) ->
			@editor.gotoLine(line)
			@editor.focus()