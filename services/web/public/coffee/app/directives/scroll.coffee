define [
	"base"
], (App) ->

	fakeNgModel = (initValue) ->
		$setViewValue: (value) ->
			@$viewValue = value
			return

		$viewValue: initValue

	App.directive "scrollGlue", ->
		return {

			priority: 1
			require: ["?ngModel"]
			restrict: "A"

			link: (scope, $el, attrs, ctrls) ->
				scrollToBottom = ->
					el.scrollTop = el.scrollHeight

				shouldActivateAutoScroll = ->
					el.scrollTop + el.clientHeight + 10 >= el.scrollHeight

				el = $el[0]
				ngModel = ctrls[0] or fakeNgModel(true)
				scope.$watch ->
					scrollToBottom()  if ngModel.$viewValue

				$el.bind "scroll", ->
					activate = shouldActivateAutoScroll()
					scope.$apply ngModel.$setViewValue.bind(ngModel, activate)  if activate isnt ngModel.$viewValue
		}
