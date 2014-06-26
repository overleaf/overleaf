define [], () ->
	class CursorPositionManager
		constructor: (@$scope, @editor, @element) ->

			@editor.on "changeSession", (e) =>
				e.session.on "changeScrollTop", (e) =>
					@onScrollTopChange(e)

				e.session.selection.on 'changeCursor', (e) =>
					@onCursorChange(e)

				@gotoStoredPosition()

		onScrollTopChange: (event) ->
			if !@ignoreCursorPositionChanges and doc_id = @$scope.sharejsDoc?.doc_id
				docPosition = $.localStorage("doc.position.#{doc_id}") || {}
				docPosition.scrollTop = @editor.getSession().getScrollTop()
				$.localStorage("doc.position.#{doc_id}", docPosition)
			
		onCursorChange: (event) ->
			if !@ignoreCursorPositionChanges and doc_id = @$scope.sharejsDoc?.doc_id
				docPosition = $.localStorage("doc.position.#{doc_id}") || {}
				docPosition.cursorPosition = @editor.getCursorPosition()
				$.localStorage("doc.position.#{doc_id}", docPosition)

		gotoStoredPosition: () ->
			doc_id = @$scope.sharejsDoc?.doc_id
			return if !doc_id?
			pos = $.localStorage("doc.position.#{doc_id}") || {}
			@ignoreCursorPositionChanges = true
			@editor.moveCursorToPosition(pos.cursorPosition or {row: 0, column: 0})
			@editor.getSession().setScrollTop(pos.scrollTop or 0)
			delete @ignoreCursorPositionChanges