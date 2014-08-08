define [
	"ace/ace"
], () ->
	Range = ace.require("ace/range").Range

	class HighlightsManager
		constructor: (@$scope, @editor, @element) ->
			@markerIds = []
			@labels = []

			@$scope.annotationLabel = {
				show: false
				right:  "auto"
				left:   "auto"
				top:    "auto"
				bottom: "auto"
				backgroundColor: "black"
				text: ""
			}

			@$scope.updateLabels = {
				updatesAbove: 0
				updatesBelow: 0
			}

			@$scope.$watch "highlights", (value) =>
				@redrawAnnotations()

			@$scope.$watch "theme", (value) =>
				@redrawAnnotations()

			@editor.on "mousemove", (e) =>
				position = @editor.renderer.screenToTextCoordinates(e.clientX, e.clientY)
				e.position = position
				@showAnnotationLabels(position)

			onChangeScrollTop = () =>
				@updateShowMoreLabels()

			@editor.getSession().on "changeScrollTop", onChangeScrollTop

			@$scope.$watch "text", () =>
				if @$scope.navigateHighlights
					setTimeout () =>
						@scrollToFirstHighlight()
					, 0

			@editor.on "changeSession", (e) =>
				e.oldSession?.off "changeScrollTop", onChangeScrollTop
				e.session.on "changeScrollTop", onChangeScrollTop
				@redrawAnnotations()

			@$scope.gotoHighlightBelow = () =>
				return if !@firstHiddenHighlightAfter?
				@editor.scrollToLine(@firstHiddenHighlightAfter.end.row, true, false)

			@$scope.gotoHighlightAbove = () =>
				return if !@lastHiddenHighlightBefore?
				@editor.scrollToLine(@lastHiddenHighlightBefore.start.row, true, false)

		redrawAnnotations: () ->
			@_clearMarkers()
			@_clearLabels()

			for annotation in @$scope.highlights or []
				do (annotation) =>
					colorScheme = @_getColorScheme(annotation.hue)
					if annotation.cursor?
						@labels.push {
							text: annotation.label
							range: new Range(
								annotation.cursor.row, annotation.cursor.column,
								annotation.cursor.row, annotation.cursor.column + 1
							)
							colorScheme: colorScheme
							snapToStartOfRange: true
						}
						@_drawCursor(annotation, colorScheme)
					else if annotation.highlight?
						@labels.push {
							text: annotation.label
							range: new Range(
								annotation.highlight.start.row, annotation.highlight.start.column,
								annotation.highlight.end.row,   annotation.highlight.end.column
							)
							colorScheme: colorScheme
						}
						@_drawHighlight(annotation, colorScheme)
					else if annotation.strikeThrough?
						@labels.push {
							text: annotation.label
							range: new Range(
								annotation.strikeThrough.start.row, annotation.strikeThrough.start.column,
								annotation.strikeThrough.end.row,   annotation.strikeThrough.end.column
							)
							colorScheme: colorScheme
						}
						@_drawStrikeThrough(annotation, colorScheme)

			@updateShowMoreLabels()

		showAnnotationLabels: (position) ->
			labelToShow = null
			for label in @labels or []
				if label.range.contains(position.row, position.column)
					labelToShow = label

			if !labelToShow?
				@$scope.$apply () =>
					@$scope.annotationLabel.show = false
			else
				$ace = $(@editor.renderer.container).find(".ace_scroller")
				# Move the label into the Ace content area so that offsets and positions are easy to calculate.
				$ace.append(@element.find(".annotation-label"))

				if labelToShow.snapToStartOfRange
					coords = @editor.renderer.textToScreenCoordinates(labelToShow.range.start.row, labelToShow.range.start.column)
				else
					coords = @editor.renderer.textToScreenCoordinates(position.row, position.column)

				offset = $ace.offset()
				height = $ace.height()
				coords.pageX = coords.pageX - offset.left
				coords.pageY = coords.pageY - offset.top

				if coords.pageY > @editor.renderer.lineHeight * 2
					top    = "auto"
					bottom = height - coords.pageY
				else
					top    = coords.pageY + @editor.renderer.lineHeight
					bottom = "auto"

				# Apply this first that the label has the correct width when calculating below
				@$scope.$apply () =>
					@$scope.annotationLabel.text = labelToShow.text
					@$scope.annotationLabel.show = true

				$label = @element.find(".annotation-label")

				if coords.pageX + $label.outerWidth() < $ace.width()
					left  = coords.pageX
					right = "auto"
				else
					right = 0
					left = "auto"

				@$scope.$apply () =>
					@$scope.annotationLabel = {
						show:   true
						left:   left
						right:  right
						bottom: bottom
						top:    top
						backgroundColor: labelToShow.colorScheme.labelBackgroundColor
						text:   labelToShow.text
					}

		updateShowMoreLabels: () ->
			return if !@$scope.navigateHighlights
			setTimeout () =>
				firstRow = @editor.getFirstVisibleRow()
				lastRow  = @editor.getLastVisibleRow()
				highlightsBefore = 0
				highlightsAfter = 0
				@lastHiddenHighlightBefore = null
				@firstHiddenHighlightAfter = null
				for annotation in @$scope.highlights or []
					range = annotation.highlight or annotation.strikeThrough
					continue if !range?
					if range.start.row < firstRow
						highlightsBefore += 1
						@lastHiddenHighlightBefore = range
					if range.end.row > lastRow
						highlightsAfter += 1
						@firstHiddenHighlightAfter ||= range

				@$scope.$apply =>
					@$scope.updateLabels = {
						highlightsBefore: highlightsBefore
						highlightsAfter:  highlightsAfter
					}
			, 100

		scrollToFirstHighlight: () ->
			for annotation in @$scope.highlights or []
				range = annotation.highlight or annotation.strikeThrough
				continue if !range?
				@editor.scrollToLine(range.start.row, true, false)
				break

		_clearMarkers: () ->
			for marker_id in @markerIds
				@editor.getSession().removeMarker(marker_id)
			@markerIds = []

		_clearLabels: () ->
			@labels = []

		_drawCursor: (annotation, colorScheme) ->
			@markerIds.push @editor.getSession().addMarker new Range(
				annotation.cursor.row, annotation.cursor.column,
				annotation.cursor.row, annotation.cursor.column + 1
			), "annotation remote-cursor", (html, range, left, top, config) ->
				div = """
					<div
						class='remote-cursor custom ace_start'
						style='height: #{config.lineHeight}px; top:#{top}px; left:#{left}px; border-color: #{colorScheme.cursor};'
					>
						<div class="nubbin" style="bottom: #{config.lineHeight}px; background-color: #{colorScheme.cursor};"></div>
					</div>
				"""
				html.push div
			, true

		_drawHighlight: (annotation, colorScheme) ->
			@_addMarkerWithCustomStyle(
				new Range(
					annotation.highlight.start.row, annotation.highlight.start.column,
					annotation.highlight.end.row,   annotation.highlight.end.column
				),
				"annotation highlight",
				false,
				"background-color: #{colorScheme.highlightBackgroundColor}"
			)

		_drawStrikeThrough: (annotation, colorScheme) ->
			lineHeight = @editor.renderer.lineHeight
			@_addMarkerWithCustomStyle(
				new Range(
					annotation.strikeThrough.start.row, annotation.strikeThrough.start.column,
					annotation.strikeThrough.end.row,   annotation.strikeThrough.end.column
				),
				"annotation strike-through-background",
				false,
				"background-color: #{colorScheme.strikeThroughBackgroundColor}"
			)
			@_addMarkerWithCustomStyle(
				new Range(
					annotation.strikeThrough.start.row, annotation.strikeThrough.start.column,
					annotation.strikeThrough.end.row,   annotation.strikeThrough.end.column
				),
				"annotation strike-through-foreground",
				true,
				"""
					height: #{Math.round(lineHeight/2) + 2}px;
					border-bottom: 2px solid #{colorScheme.strikeThroughForegroundColor};
				"""
			)

		_addMarkerWithCustomStyle: (range, klass, foreground, style) ->
			if foreground?
				markerLayer = @editor.renderer.$markerBack
			else
				markerLayer = @editor.renderer.$markerFront

			@markerIds.push @editor.getSession().addMarker range, klass, (html, range, left, top, config) ->
				if range.isMultiLine()
					markerLayer.drawTextMarker(html, range, klass, config, style)
				else
					markerLayer.drawSingleLineMarker(html, range, "#{klass} ace_start", config, 0, style)
			, foreground

		_getColorScheme: (hue) ->
			if @_isDarkTheme()
				return {
					cursor: "hsl(#{hue}, 70%, 50%)"
					labelBackgroundColor: "hsl(#{hue}, 70%, 50%)"
					highlightBackgroundColor: "hsl(#{hue}, 100%, 28%);"
					strikeThroughBackgroundColor: "hsl(#{hue}, 100%, 20%);"
					strikeThroughForegroundColor: "hsl(#{hue}, 100%, 60%);"
				}
			else
				return {
					cursor: "hsl(#{hue}, 70%, 50%)"
					labelBackgroundColor: "hsl(#{hue}, 70%, 50%)"
					highlightBackgroundColor: "hsl(#{hue}, 70%, 85%);"
					strikeThroughBackgroundColor: "hsl(#{hue}, 70%, 95%);"
					strikeThroughForegroundColor: "hsl(#{hue}, 70%, 40%);"
				}

		_isDarkTheme: () ->
			rgb = @element.find(".ace_editor").css("background-color");
			[m, r, g, b] = rgb.match(/rgb\(([0-9]+), ([0-9]+), ([0-9]+)\)/)
			r = parseInt(r, 10)
			g = parseInt(g, 10)
			b = parseInt(b, 10)
			return r + g + b < 3 * 128
