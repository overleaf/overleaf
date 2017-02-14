define [
	"base"
], (App) ->
	App.directive "videoPlayState", ($parse) ->
		return {
			restrict: "A",
			link: (scope, element, attrs) ->
				videoDOMEl = element[0]
				scope.$watch (() -> $parse(attrs.videoPlayState)(scope)), (shouldPlay) ->
					if shouldPlay
						videoDOMEl.currentTime = 0
						videoDOMEl.play()
					else 
						videoDOMEl.pause()
		}
