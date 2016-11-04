define [
	"base"
], (App) ->
	App.directive "reviewPanelSorted", () ->
		return  {
			link: (scope, element, attrs) ->
				scope.$watch "reviewPanel.entries", (value) ->
					return if !value?
					entries = []
					for el in element.find(".review-entry")
						entries.push {
							el: el
							scope: angular.element(el).scope()
						}
					entries.sort (a,b) -> a.scope.entry.offset - b.scope.entry.offset
					
					previousBottom = 0
					for entry in entries
						height = $(entry.el).height()
						top = entry.scope.entry.screenPos.y
						top = Math.max(top, previousBottom + 12)
						previousBottom = top + height
						entry.scope.top = top
		}