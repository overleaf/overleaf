define [
	"base"
], (App) ->
	App.directive "reviewPanelSorted", ($timeout) ->
		return  {
			link: (scope, element, attrs) ->
				previous_focused_entry_index = 0
				
				layout = (animate = true) ->
					if animate
						element.removeClass("no-animate")
					else
						element.addClass("no-animate")
					sl_console.log "LAYOUT"
					if scope.ui.reviewPanelOpen
						PADDING = 8
						TOOLBAR_HEIGHT = 38
						OVERVIEW_TOGGLE_HEIGHT = 57
					else
						PADDING = 4
						TOOLBAR_HEIGHT = 4
						OVERVIEW_TOGGLE_HEIGHT = 0
					
					entries = []
					for el in element.find(".rp-entry-wrapper")
						entry = {
							$indicator_el: $(el).find(".rp-entry-indicator")
							$box_el: $(el).find(".rp-entry")
							$callout_el: $(el).find(".rp-entry-callout")
							scope: angular.element(el).scope()
						}
						if scope.ui.reviewPanelOpen
							entry.$layout_el = entry.$box_el
						else
							entry.$layout_el = entry.$indicator_el
						entry.height = entry.$layout_el.height() # Do all of our DOM reads first for perfomance, see http://wilsonpage.co.uk/preventing-layout-thrashing/
						entries.push entry
					entries.sort (a,b) -> a.scope.entry.offset - b.scope.entry.offset
					
					return if entries.length == 0
					
					line_height = scope.reviewPanel.rendererData.lineHeight

					focused_entry_index = Math.min(previous_focused_entry_index, entries.length - 1)
					for entry, i in entries
						if entry.scope.entry.focused
							focused_entry_index = i
							break
					entries_after = entries.slice(focused_entry_index + 1)
					entries_before = entries.slice(0, focused_entry_index)
					focused_entry = entries[focused_entry_index]
					previous_focused_entry_index = focused_entry_index
					
					sl_console.log "focused_entry_index", focused_entry_index

					positionLayoutEl = ($callout_el, original_top, top) ->
						if original_top <= top
							$callout_el.removeClass("rp-entry-callout-inverted")
							$callout_el.css(top: original_top + line_height - 1, height: top - original_top)
						else
							$callout_el.addClass("rp-entry-callout-inverted")
							$callout_el.css(top: top + line_height, height: original_top - top)

					# Put the focused entry as close to where it wants to be as possible
					focused_entry_top = Math.max(focused_entry.scope.entry.screenPos.y, TOOLBAR_HEIGHT)
					focused_entry.$box_el.css(top: focused_entry_top)
					focused_entry.$indicator_el.css(top: focused_entry_top)
					positionLayoutEl(focused_entry.$callout_el, focused_entry.scope.entry.screenPos.y, focused_entry_top)

					previousBottom = focused_entry_top + focused_entry.$layout_el.height()
					for entry in entries_after
						original_top = entry.scope.entry.screenPos.y
						height = entry.height
						top = Math.max(original_top, previousBottom + PADDING)
						previousBottom = top + height
						entry.$box_el.css(top: top)
						entry.$indicator_el.css(top: top)
						positionLayoutEl(entry.$callout_el, original_top, top)
						sl_console.log "ENTRY", {entry: entry.scope.entry, top}
					
					lastBottom = previousBottom

					previousTop = focused_entry_top
					entries_before.reverse() # Work through backwards, starting with the one just above
					for entry, i in entries_before
						original_top = entry.scope.entry.screenPos.y
						height = entry.height
						original_bottom = original_top + height
						bottom = Math.min(original_bottom, previousTop - PADDING)
						top = bottom - height
						previousTop = top
						entry.$box_el.css(top: top)
						entry.$indicator_el.css(top: top)
						positionLayoutEl(entry.$callout_el, original_top, top)
						sl_console.log "ENTRY", {entry: entry.scope.entry, top}

					lastTop = top
					if lastTop < TOOLBAR_HEIGHT
						overflowTop = -lastTop + TOOLBAR_HEIGHT
					else
						overflowTop = 0
					scope.$emit "review-panel:sizes", {
						overflowTop: overflowTop,
						height: previousBottom + OVERVIEW_TOGGLE_HEIGHT
					}
				
				scope.$applyAsync () ->
					layout()
				
				scope.$on "review-panel:layout", (e, animate = true) ->
					scope.$applyAsync () ->
						layout(animate)
				
				scope.$watch "reviewPanel.rendererData.lineHeight", () ->
					layout()

				## Scroll lock with Ace
				scroller = element
				list = element.find(".rp-entry-list-inner")
				
				# If we listen for scroll events in the review panel natively, then with a Mac trackpad
				# the scroll is very smooth (natively done I'd guess), but we don't get polled regularly
				# enough to keep Ace in step, and it noticeably lags. If instead, we borrow the manual
				# mousewheel/trackpad scrolling behaviour from Ace, and turn mousewheel events into
				# scroll events ourselves, then it makes the review panel slightly less smooth (barely)
				# noticeable, but keeps it perfectly in step with Ace.
				ace.require("ace/lib/event").addMouseWheelListener scroller[0], (e) ->
					deltaY = e.wheelY
					old_top = parseInt(list.css("top"))
					top = old_top - deltaY * 4
					scrollAce(-top)
					e.preventDefault()

				# We always scroll by telling Ace to scroll and then updating the 
				# review panel. This lets Ace manage the size of the scroller and
				# when it overflows.
				ignoreNextAceEvent = false

				scrollPanel = (scrollTop, height) ->
					if ignoreNextAceEvent
						ignoreNextAceEvent = false
					else
						ignoreNextPanelEvent = true
						list.height(height)
						# console.log({height, scrollTop, top: height - scrollTop})
						list.css(top: - scrollTop)
			
				scrollAce = (scrollTop) ->
					scope.reviewPanelEventsBridge.emit "externalScroll", scrollTop
				
				scope.reviewPanelEventsBridge.on "aceScroll", scrollPanel
				scope.$on "$destroy", () ->
					scope.reviewPanelEventsBridge.off "aceScroll"
				
				scope.reviewPanelEventsBridge.emit "refreshScrollPosition"
		}	
