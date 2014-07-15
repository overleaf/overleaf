define [
	"base"
], (App) ->
	App.directive "updateScrollBottomOn", ->
		return {
			restrict: "A"
			link: (scope, element, attrs, ctrls) ->
				# We keep the offset from the bottom fixed whenever the event fires
				#
				# ^   | ^
				# |   | | scrollTop
				# |   | v
				# |   |-----------
				# |   | ^
				# |   | |
				# |   | | clientHeight (viewable area)
				# |   | |
				# |   | |
				# |   | v
				# |   |-----------
				# |   | ^
				# |   | | scrollBottom
				# v   | v
				#  \
				#   scrollHeight
				
				scrollBottom = 0
				element.on "scroll", (e) ->
					scrollBottom = element[0].scrollHeight - element[0].scrollTop - element[0].clientHeight
					
				scope.$on attrs.updateScrollBottomOn, () ->
					setTimeout () ->
						element.scrollTop(element[0].scrollHeight - element[0].clientHeight - scrollBottom)
					, 0
		}

