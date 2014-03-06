define [
	"ace/ace"
	"ace/mode/latex"
	"ace/range"
	"libs/backbone"
], (Ace, LatexMode, Range)->
	DiffView = Backbone.View.extend
		initialize: () ->
			@model.on "change:diff", () => @render()
			@render()

		render: ->
			diff = @model.get("diff")
			return unless diff?
			@createAceEditor()
			@aceEditor.setValue(@getPlainDiffContent())
			@aceEditor.clearSelection()
			session = @aceEditor.getSession()
			session.setMode(new LatexMode.Mode())
			session.setUseWrapMode(true)
			@insertMarkers()
			return @

		createAceEditor: () ->
			@$el.empty()
			$editor = $("<div/>")
			@$el.append($editor)
			@aceEditor = Ace.edit($editor[0])
			@aceEditor.setTheme("ace/theme/#{window.userSettings.theme}")
			@aceEditor.setReadOnly true
			@aceEditor.setShowPrintMargin(false)

			@aceEditor.on "mousemove", (e) =>
				position = @aceEditor.renderer.screenToTextCoordinates(e.clientX, e.clientY)
				e.position = position
				@updateVisibleNames(e)

		getPlainDiffContent: () ->
			content = ""
			for entry in @model.get("diff") or []
				content += entry.u or entry.i or entry.d or ""
			return content

		insertMarkers: () ->
			row    = 0
			column = 0
			for entry, i in @model.get("diff") or []
				content = entry.u or entry.i or entry.d
				lines   = content.split("\n")
				startRow    = row
				startColumn = column
				if lines.length > 1
					endRow    = startRow + lines.length - 1
					endColumn = lines[lines.length - 1].length
				else
					endRow    = startRow
					endColumn = startColumn + lines[0].length
				row    = endRow
				column = endColumn

				range = new Range.Range(
					startRow, startColumn, endRow, endColumn
				)
				@addMarker(range, "change-marker-#{i}", entry)

		addMarker: (range, id, entry) ->
			session  = @aceEditor.getSession()
			markerBackLayer = @aceEditor.renderer.$markerBack
			markerFrontLayer = @aceEditor.renderer.$markerFront
			lineHeight = @aceEditor.renderer.lineHeight
			if entry.i? or entry.d?
				hue = 200
				if entry.i?
					@_addMarkerWithCustomStyle session, markerBackLayer, range, "deleted-change-background", false, """
						background-color : hsl(#{hue}, 70%, 85%);
					"""
					tag = "Added by #{entry.meta.user.email}"
				if entry.d?
					@_addMarkerWithCustomStyle session, markerBackLayer, range, "deleted-change-background", false, """
						background-color : hsl(#{hue}, 70%, 95%);
					"""
					@_addMarkerWithCustomStyle session, markerBackLayer, range, "deleted-change-foreground", true, """
						height: #{Math.round(lineHeight/2) - 1}px;
						border-bottom: 2px solid hsl(#{hue}, 70%, 40%);
					"""
					tag = "Deleted by #{entry.meta.user.email}"

				tag += " on #{entry.meta.end_ts}"
				@_addNameTag session, id, range, tag, """
					background-color : hsl(#{hue}, 70%, 85%);
				"""

		_addMarkerWithCustomStyle: (session, markerLayer, range, klass, foreground, style) ->
			session.addMarker range, klass, (html, range, left, top, config) ->
				if range.isMultiLine()
					markerLayer.drawTextMarker(html, range, klass, config, style)
				else
					markerLayer.drawSingleLineMarker(html, range, "#{klass} ace_start", config, 0, style)
			, foreground

		_addNameTag: (session, id, range, content, style) ->
			@nameMarkers ||= []
			@nameMarkers.push
				range: range
				id: id
			startRange = new Range.Range(
				range.start.row, range.start.column
				range.start.row, session.getScreenLastRowColumn(range.start.row)
			)
			session.addMarker startRange, "change-name-marker", (html, range, left, top, config) ->
				html.push """
					<div
						id    = '#{id}'
						class = 'change-name-marker'
						style = '
							height: #{config.lineHeight}px;
							top:    #{top}px;
							left:   #{left}px;
						'
					>
						<div
							class="name" style="
								display: none;
								bottom: #{config.lineHeight + 2}px;
								#{style}
							">#{content}</div>
					</div>
				"""
			, true

		updateVisibleNames: (e) ->
			for marker in @nameMarkers or []
				if marker.range.contains(e.position.row, e.position.column)
					$("##{marker.id}").find(".name").show()
				else
					$("##{marker.id}").find(".name").hide()

	return DiffView

