define [
	"base"
], (App) ->
	fakeNgModel = (initValue) ->
		$setViewValue: (value) ->
			@$viewValue = value
			return
		$viewValue: initValue
		
	App.directive "updateScrollBottomOn", ->
		# return {
		# 	priority: 1
		# 	require: ["?ngModel"]
		# 	restrict: "A"
		# 	link: (scope, $el, attrs, ctrls) ->
		# 		scrollToBottom = ->
		# 			el.scrollTop = el.scrollHeight
		# 			return
		# 			
		# 		shouldActivateAutoScroll = ->
		# 			# + 1 catches off by one errors in chrome
		# 			el.scrollTop + el.clientHeight + 1 >= el.scrollHeight
		# 			
		# 	
		# 		el = $el[0]
		# 		ngModel = ctrls[0] or fakeNgModel(true)
		# 		
		# 		scope.$watch ->
		# 			console.log "SCOPE CHANGED", ngModel.$viewValue
		# 			if ngModel.$viewValue
		# 				scrollToBottom() 
		# 			
		# 		$el.bind "scroll", ->
		# 			activate = shouldActivateAutoScroll()
		# 			scope.$apply ngModel.$setViewValue.bind(ngModel, activate)  if activate isnt ngModel.$viewValue
		# 				
		# 		return
		# }

		
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
					console.log "SCROLL BOTTOM CHANGED", scrollBottom
					
				scope.$on attrs.updateScrollBottomOn, () ->
					setTimeout () ->
						console.log "RESTORING SCROLL BOTTOM", scrollBottom
						element.scrollTop(element[0].scrollHeight - element[0].clientHeight - scrollBottom)
					, 0
		}

