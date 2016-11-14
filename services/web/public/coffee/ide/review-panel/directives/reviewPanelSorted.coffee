define [
	"base"
], (App) ->
	App.directive "reviewPanelSorted", ($timeout) ->
		return  {
			link: (scope, element, attrs) ->
				layout = () ->
					sl_console.log "LAYOUT"
					entries = []
					for el in element.find(".rp-entry-wrapper")
						entries.push {
							$box_el: $(el).find(".rp-entry")
							$callout_el: $(el).find(".rp-entry-callout")
							scope: angular.element(el).scope()
						}
					entries.sort (a,b) -> a.scope.entry.offset - b.scope.entry.offset
					
					previousBottom = 28 # This should start at the height of the toolbar
					for entry in entries
						height = entry.$box_el.height()
						original_top = entry.scope.entry.screenPos.y
						top = Math.max(original_top, previousBottom + 12)
						previousBottom = top + height
						entry.$box_el.css(top: top)
						entry.$callout_el.css(top: original_top + 15, height: top - original_top)
						sl_console.log "ENTRY", {entry: entry.scope.entry, top}
				
				scope.$watch "reviewPanel.entryGeneration", (value) ->
					scope.$evalAsync () ->
						layout()
				
				scope.$on "review-panel:layout", () ->
					scope.$evalAsync () ->
						layout()
		}