define [
	"ace/ace"
	"ace/mode/latex"
	"ace/range"
	"moment"
	"libs/backbone"
], (Ace, LatexMode, Range, moment)->
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
			@insertNameTag()
			return @

		destroy: () ->
			@$editor?.remove()

		createAceEditor: () ->
			@$el.empty()
			@$editor = $("<div/>")
			@$el.append(@$editor)
			@aceEditor = Ace.edit(@$editor[0])
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
			@entries = []
			for entry, i in @model.get("diff") or []
				content = entry.u or entry.i or entry.d
				content ||= ""
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
				entry.range = range
				@addMarker(range, entry)
				if entry.i? or entry.d?
					@entries.push entry

		addMarker: (range, entry) ->
			session  = @aceEditor.getSession()
			markerBackLayer = @aceEditor.renderer.$markerBack
			markerFrontLayer = @aceEditor.renderer.$markerFront
			lineHeight = @aceEditor.renderer.lineHeight
			if entry.i? or entry.d?
				hue = entry.meta.user.hue()
				if entry.i?
					@_addMarkerWithCustomStyle session, markerBackLayer, range, "inserted-change-background", false, """
						background-color : hsl(#{hue}, 70%, 85%);
					"""
				if entry.d?
					@_addMarkerWithCustomStyle session, markerBackLayer, range, "deleted-change-background", false, """
						background-color : hsl(#{hue}, 70%, 95%);
					"""
					@_addMarkerWithCustomStyle session, markerBackLayer, range, "deleted-change-foreground", true, """
						height: #{Math.round(lineHeight/2) - 1}px;
						border-bottom: 2px solid hsl(#{hue}, 70%, 40%);
					"""

		_addMarkerWithCustomStyle: (session, markerLayer, range, klass, foreground, style) ->
			session.addMarker range, klass, (html, range, left, top, config) ->
				if range.isMultiLine()
					markerLayer.drawTextMarker(html, range, klass, config, style)
				else
					markerLayer.drawSingleLineMarker(html, range, "#{klass} ace_start", config, 0, style)
			, foreground

		insertNameTag: () ->
			@$ace = $(@aceEditor.renderer.container).find(".ace_scroller")
			@$nameTagEl = $("<div class='change-name-marker'></div>")
			@$nameTagEl.css({
				position: "absolute"
			})
			@$nameTagEl.hide()
			@$ace.append(@$nameTagEl)

		_drawNameTag: (entry, position) ->
			@$nameTagEl.show()
			
			if entry.i?
				text = "Added by #{entry.meta.user.name()}"
			else if entry.d?
				text = "Deleted by #{entry.meta.user.name()}"
			date = moment(parseInt(entry.meta.end_ts, 10)).format("Do MMM YYYY, h:mm a")
			text += " on #{date}"
			@$nameTagEl.text(text)

			position = @aceEditor.renderer.textToScreenCoordinates(position.row, position.column)
			offset = @$ace.offset()
			position.pageX = position.pageX - offset.left
			position.pageY = position.pageY - offset.top
			height = @$ace.height()

			hue = entry.meta.user.hue()
			css = {
				"background-color" : "hsl(#{hue}, 70%, 90%)";
			}

			if position.pageX + @$nameTagEl.width() < @$ace.width()
				css["left"] = position.pageX
				css["right"] = "auto"
			else
				css["right"] = 0
				css["left"] = "auto"

			if position.pageY > 2 * @$nameTagEl.height()
				css["bottom"] = height - position.pageY
				css["top"] = "auto"
			else
				css["top"] = position.pageY + @aceEditor.renderer.lineHeight
				css["bottom"] = "auto"

			@$nameTagEl.css css

		_hideNameTag: () ->
			@$nameTagEl.hide()

		updateVisibleNames: (e) ->
			visibleName = false
			for entry in @entries or []
				if entry.range.contains(e.position.row, e.position.column)
					@_drawNameTag(entry, e.position)
					visibleName = true
					break
			if !visibleName
				@_hideNameTag()

	return DiffView

