define [
	"ace/ace"
	"ace/mode/latex"
	"ace/range"
	"moment"
	"libs/backbone"
	"libs/mustache"
], (Ace, LatexMode, Range, moment)->
	DiffView = Backbone.View.extend
		template: $("#trackChangesDiffTemplate").html()

		events:
			"click .restore": () ->
				console.log "click"
				@trigger "restore"

		initialize: () ->
			@model.on "change:diff", () => @render()

		render: ->
			diff = @model.get("diff")
			return unless diff?
			@createAceEditor()
			@aceEditor.setValue(@getPlainDiffContent())
			@aceEditor.clearSelection()
			@$ace = $(@aceEditor.renderer.container).find(".ace_scroller")
			@insertMarkers()
			@insertNameTag()
			@insertMoreChangeLabels()
			@bindToScrollEvents()
			@scrollToFirstChange()
			return @

		remove: () ->
			@$editor?.remove()
			@undelegateEvents()

		createAceEditor: () ->
			changes = @getNumberOfChanges()
			html = Mustache.to_html @template, {
				changes: "#{changes} change#{if changes > 1 then "s" else ""}"
				name: @model.get("doc")?.get("name")
			}
			@$el.html(html)
			@$editor = @$(".track-changes-diff-editor")
			@$el.append(@$editor)
			@aceEditor = Ace.edit(@$editor[0])
			@aceEditor.setTheme("ace/theme/#{window.userSettings.theme}")
			@aceEditor.setReadOnly true
			@aceEditor.setShowPrintMargin(false)
			session = @aceEditor.getSession()
			session.setMode(new LatexMode.Mode())
			session.setUseWrapMode(true)

			@aceEditor.on "mousemove", (e) =>
				position = @aceEditor.renderer.screenToTextCoordinates(e.clientX, e.clientY)
				e.position = position
				@updateVisibleNames(e)

		bindToScrollEvents: () ->
			@aceEditor.getSession().on "changeScrollTop", (e) =>
				@updateMoreChangeLabels()

		getPlainDiffContent: () ->
			content = ""
			for entry in @model.get("diff") or []
				content += entry.u or entry.i or entry.d or ""
			return content

		getNumberOfChanges: () ->
			changes = 0
			for entry in @model.get("diff") or []
				changes += 1 if entry.i? or entry.d?
			return changes

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

			dark = @_isDarkTheme()

			if entry.i? or entry.d?
				hue = entry.meta.user.hue()
				if entry.i?
					if dark
						style = "background-color : hsl(#{hue}, 100%, 28%);"
					else
						style = "background-color : hsl(#{hue}, 70%, 85%);"
					@_addMarkerWithCustomStyle session, markerBackLayer, range, "inserted-change-background", false, style
				if entry.d?
					if dark
						bgStyle = "background-color: hsl(#{hue}, 100%, 20%);"
						fgStyle = "border-bottom: 2px solid hsl(#{hue}, 100%, 60%);"
					else
						bgStyle = "background-color: hsl(#{hue}, 70%, 95%);"
						fgStyle = "border-bottom: 2px solid hsl(#{hue}, 70%, 40%);"
					fgStyle += "; height: #{Math.round(lineHeight/2) - 1}px;"
					@_addMarkerWithCustomStyle session, markerBackLayer, range, "deleted-change-background", false, bgStyle
					@_addMarkerWithCustomStyle session, markerBackLayer, range, "deleted-change-foreground", true, fgStyle

		_addMarkerWithCustomStyle: (session, markerLayer, range, klass, foreground, style) ->
			session.addMarker range, klass, (html, range, left, top, config) ->
				if range.isMultiLine()
					markerLayer.drawTextMarker(html, range, klass, config, style)
				else
					markerLayer.drawSingleLineMarker(html, range, "#{klass} ace_start", config, 0, style)
			, foreground

		_isDarkTheme: () ->
			rgb = $(".ace_editor").css("background-color");
			[m, r, g, b] = rgb.match(/rgb\(([0-9]+), ([0-9]+), ([0-9]+)\)/)
			r = parseInt(r, 10)
			g = parseInt(g, 10)
			b = parseInt(b, 10)
			return r + g + b < 3 * 128

		insertNameTag: () ->
			@$nameTagEl = $("<div class='change-name-marker'></div>")
			@$nameTagEl.css({
				position: "absolute"
			})
			@$nameTagEl.hide()
			@$ace.append(@$nameTagEl)

		insertMoreChangeLabels: () ->
			@$changesBefore = $("<a class='changes-before' href='#'><span></span> <i class='icon-arrow-up'></a>")
			@$changesAfter = $("<a class='changes-after' href='#'><span></span> <i class='icon-arrow-down'></a>")
			@$ace.append(@$changesBefore)
			@$ace.append(@$changesAfter)
			@$changesBefore.on "click", () =>
				@gotoLastHiddenChangeBefore()
			@$changesAfter.on "click", () =>
				@gotoFirstHiddenChangeAfter()
			@updateMoreChangeLabels()

		scrollToFirstChange: () ->
			@aceEditor.scrollToLine(0)
			setTimeout () =>
				if @entries? and @entries[0]?
					row = @entries[0].range.start.row
					@aceEditor.scrollToLine(row, true, false)
			, 10

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
			if @_isDarkTheme()
				css = { "background-color" : "hsl(#{hue}, 100%, 20%)"; }
			else
				css = { "background-color" : "hsl(#{hue}, 70%, 90%)"; }

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
			@$nameTagEl?.hide()

		updateVisibleNames: (e) ->
			visibleName = false
			for entry in @entries or []
				if entry.range.contains(e.position.row, e.position.column)
					@_drawNameTag(entry, e.position)
					visibleName = true
					break
			if !visibleName
				@_hideNameTag()

		updateMoreChangeLabels: () ->
			return if !@$changesBefore or !@$changesAfter
			setTimeout () =>
				firstRow = @aceEditor.getFirstVisibleRow()
				lastRow = @aceEditor.getLastVisibleRow()
				changesBefore = 0
				changesAfter = 0
				@lastHiddenChangeBefore = null
				@firstHiddenChangeAfter = null
				for entry in @entries or []
					if entry.range.start.row < firstRow
						changesBefore += 1
						@lastHiddenChangeBefore = entry
					if entry.range.end.row > lastRow
						changesAfter += 1
						@firstHiddenChangeAfter ||= entry

				if changesBefore > 0
					@$changesBefore.find("span").text("#{changesBefore} more change#{if changesBefore > 1 then "s" else ""} above")
					@$changesBefore.show()
				else
					@$changesBefore.hide()
				if changesAfter > 0
					@$changesAfter.find("span").text("#{changesAfter} more change#{if changesAfter > 1 then "s" else ""} below")
					@$changesAfter.show()
				else
					@$changesAfter.hide()
			, 100

		gotoLastHiddenChangeBefore: () ->
			return if !@lastHiddenChangeBefore
			@aceEditor.scrollToLine(@lastHiddenChangeBefore.range.start.row, true, false)

		gotoFirstHiddenChangeAfter: () ->
			return if !@firstHiddenChangeAfter
			@aceEditor.scrollToLine(@firstHiddenChangeAfter.range.end.row, true, false)

		resize: () ->
			@aceEditor.resize()

	return DiffView

