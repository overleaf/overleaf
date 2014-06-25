define [
	"ace/range"
], () ->
	Range = require("ace/range").Range

	class AnnotationsManager
		constructor: (@$scope, @editor) ->
			@markerIds = []

			@$scope.$watch "annotations", (value) =>
				if value?
					@redrawAnnotations()

		redrawAnnotations: () ->
			console.log "REDRAWING ANNOTATIONS"
			for marker_id in @markerIds
				@editor.getSession().removeMarker(marker_id)
			@markerIds = []

			for annotation in @$scope.annotations or []
				do (annotation) =>
					console.log "DRAWING ANNOTATION", annotation
					@markerIds.push @editor.getSession().addMarker new Range(
						annotation.cursor.row, annotation.cursor.column,
						annotation.cursor.row, annotation.cursor.column + 1
					), "remote-cursor", (html, range, left, top, config) ->
						div = """
							<div
								class='remote-cursor custom ace_start'
								style='height: #{config.lineHeight}px; top:#{top}px; left:#{left}px;'
							>
								<div class="nubbin" style="bottom: #{config.lineHeight - 2}px"></div>
								<div class="name" style="display: none; bottom: #{config.lineHeight - 2}px">#{$('<div/>').text(annotation.text).html()}</div>
							</div>
						"""
						html.push div
					, true