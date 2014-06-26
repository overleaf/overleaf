define [
	"ace/range"
], () ->
	Range = require("ace/range").Range

	class AnnotationsManager
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

			@$scope.$watch "annotations", (value) =>
				@redrawAnnotations()

			@$scope.$watch "theme", (value) =>
				@redrawAnnotations()

			@editor.on "mousemove", (e) =>
				position = @editor.renderer.screenToTextCoordinates(e.clientX, e.clientY)
				e.position = position
				@showAnnotationLabels(position)

		redrawAnnotations: () ->
			console.log "REDRAWING ANNOTATIONS"
			@_clearMarkers()
			@_clearLabels()

			for annotation in @$scope.annotations or []
				do (annotation) =>
					colorScheme = @_getColorScheme(annotation.hue)
					console.log "DRAWING ANNOTATION", annotation, colorScheme
					if annotation.cursor?
						@labels.push {
							text: annotation.text
							range: new Range(
								annotation.cursor.row, annotation.cursor.column,
								annotation.cursor.row, annotation.cursor.column + 1
							)
							colorScheme: colorScheme
							snapToStartOfRange: true
						}
						@_drawCursor(annotation, colorScheme)

		showAnnotationLabels: (position) ->
			labelToShow = null
			for label in @labels or []
				if label.range.contains(position.row, position.column)
					labelToShow = label

			@$scope.$apply () =>
				if !labelToShow?
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

					if coords.pageY > 100
						console.log "middle of page", height - coords.pageY
						top    = "auto"
						bottom = height - coords.pageY
					else
						console.log "top of page", coords.pageY
						top    = coords.pageY + @editor.renderer.lineHeight
						bottom = "auto"

					left   = coords.pageX

					console.log "TOP BOTTOM", top, bottom


					@$scope.annotationLabel = {
						show: true
						left: left
						bottom: bottom
						top:    top
						backgroundColor: labelToShow.colorScheme.labelBackgroundColor
						text: labelToShow.text
					}

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
			), "remote-cursor", (html, range, left, top, config) ->
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

		_getColorScheme: (hue) ->
			if @_isDarkTheme()
				return {
					cursor: "hsl(#{hue}, 100%, 50%)"
					labelBackgroundColor: "hsl(#{hue}, 100%, 50%)"
				}
			else
				return {
					cursor: "hsl(#{hue}, 100%, 50%)"
					labelBackgroundColor: "hsl(#{hue}, 100%, 50%)"
				}

		_isDarkTheme: () ->
			rgb = @element.find(".ace_editor").css("background-color");
			[m, r, g, b] = rgb.match(/rgb\(([0-9]+), ([0-9]+), ([0-9]+)\)/)
			r = parseInt(r, 10)
			g = parseInt(g, 10)
			b = parseInt(b, 10)
			return r + g + b < 3 * 128