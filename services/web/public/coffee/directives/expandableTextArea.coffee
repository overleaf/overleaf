define [
	"base"
], (App) ->
	App.directive "expandableTextArea", () ->
		restrict: "A"
		link: (scope, el) ->
			resetHeight = () ->
				console.log el.val()
				el.css("height", "auto")
				el.css("height", el.prop("scrollHeight"))

			scope.$watch (() -> el.val()), resetHeight

			resetHeight()


	