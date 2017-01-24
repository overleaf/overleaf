define [
	"base"
], (App) ->
	App.directive "reviewPanelToggle", () ->
		restrict: "E"
		scope: 
			onToggle: '='
			ngModel: '='
		link: (scope) ->
			scope.onChange = (args...) ->
				scope.onToggle(scope.localModel)
			scope.localModel = scope.ngModel
			scope.$watch "ngModel", (value) ->
				scope.localModel = value

		template: """
<div class="rp-toggle">
	<input id="rp-toggle-{{$id}}" type="checkbox" class="rp-toggle-hidden-input" ng-model="localModel" ng-change="onChange()" />
	<label for="rp-toggle-{{$id}}" class="rp-toggle-btn"></label>
</div>
"""
	