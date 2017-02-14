define [
	"base"
], (App) ->
	App.directive "expandableTextArea", () ->
		restrict: "A"
		link: (scope, el) ->
			resetHeight = () ->
				curHeight = el.outerHeight()
				fitHeight = el.prop("scrollHeight")
				
				if fitHeight > curHeight and el.val() != ""
					scope.$emit "expandable-text-area:resize"
					el.css("height", fitHeight) 

			scope.$watch (() -> el.val()), resetHeight

	