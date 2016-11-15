define [
	"base"
], (App) ->
	App.directive "reviewPanelSorted", ($timeout) ->
		return  {
			link: (scope, element, attrs) ->
				TOOLBAR_HEIGHT = 28
				BOX_PADDING = 12
				INDICATOR_PADDING = 4
				
				previous_focused_entry_index = 0
				
				layout = () ->
					sl_console.log "LAYOUT"
					entries = []
					for el in element.find(".rp-entry-wrapper")
						entries.push {
							$indicator_el: $(el).find(".rp-entry-indicator")
							$box_el: $(el).find(".rp-entry")
							$callout_el: $(el).find(".rp-entry-callout")
							scope: angular.element(el).scope()
						}
					entries.sort (a,b) -> a.scope.entry.offset - b.scope.entry.offset
					
					return if entries.length == 0
					
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
					
					line_height = 15
					
					# Put the focused entry exactly where it wants to be
					focused_entry_top = Math.max(TOOLBAR_HEIGHT, focused_entry.scope.entry.screenPos.y)
					focused_entry.$box_el.css(top: focused_entry_top)
					focused_entry.$indicator_el.css(top: focused_entry_top)
					focused_entry.$callout_el.css(top: focused_entry_top + line_height, height: 0)
					
					previousBoxBottom = focused_entry_top + focused_entry.$box_el.height()
					previousIndicatorBottom = focused_entry_top + focused_entry.$indicator_el.height()
					for entry in entries_after
						original_top = entry.scope.entry.screenPos.y
						box_height = entry.$box_el.height()
						box_top = Math.max(original_top, previousBoxBottom + BOX_PADDING)
						indicator_height = entry.$indicator_el.height()
						indicator_top = Math.max(original_top, previousIndicatorBottom + INDICATOR_PADDING)
						previousBoxBottom = box_top + box_height
						previousIndicatorBottom = indicator_top + indicator_height
						entry.$box_el.css(top: box_top, bottom: 'auto')
						entry.$indicator_el.css(top: indicator_top, bottom: 'auto')

						entry.$callout_el.removeClass("rp-entry-callout-inverted")
						
						if scope.ui.reviewPanelOpen
							callout_height = box_top - original_top
						else
							callout_height = indicator_top - original_top

						entry.$callout_el.css(top: original_top + line_height, height: callout_height)
						sl_console.log "ENTRY", {entry: entry.scope.entry, top}
					
					previousBoxTop = focused_entry_top
					previousIndicatorTop = focused_entry_top
					entries_before.reverse() # Work through backwards, starting with the one just above
					for entry in entries_before
						original_top = entry.scope.entry.screenPos.y
						box_height = entry.$box_el.height()
						original_box_bottom = original_top + box_height
						box_bottom = Math.min(original_box_bottom, previousBoxTop - BOX_PADDING)
						box_top = box_bottom - box_height
						indicator_height = entry.$indicator_el.height()
						original_indicator_bottom = original_top + indicator_height
						indicator_bottom = Math.min(original_indicator_bottom, previousIndicatorTop - INDICATOR_PADDING)
						indicator_top = indicator_bottom - indicator_height
						previousBoxTop = box_top
						previousIndicatorTop = indicator_top
						entry.$box_el.css(top: box_top, bottom: 'auto')
						entry.$indicator_el.css(top: indicator_top, bottom: 'auto')

						entry.$callout_el.addClass("rp-entry-callout-inverted")
						
						if scope.ui.reviewPanelOpen
							callout_top = box_top + line_height
						else
							callout_top = indicator_top + line_height

						entry.$callout_el.css(top: callout_top + 1, height: original_top - callout_top + line_height)
						sl_console.log "ENTRY", {entry: entry.scope.entry, top}
				
				scope.$watch "reviewPanel.entryGeneration", (value) ->
					scope.$evalAsync () ->
						layout()
				
				scope.$on "review-panel:layout", () ->
					scope.$evalAsync () ->
						layout()
		}