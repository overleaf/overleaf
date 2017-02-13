define [
	"base"
], (App) ->
	App.directive "reviewPanelToggle", () ->
		restrict: "E"
		scope: 
			onToggle: '='
			ngModel: '='
			disabled: '=?'
			onDisabledClick: '=?'
		link: (scope) ->
			if !scope.disabled?
				scope.disabled = false
			scope.onChange = (args...) ->
				scope.onToggle(scope.localModel)
			scope.handleClick = () ->
				if scope.disabled
					scope.onDisabledClick()
			scope.localModel = scope.ngModel
			scope.$watch "ngModel", (value) ->
				scope.localModel = value

		template: """
<div class="rp-toggle" ng-click="handleClick();">
	<input id="rp-toggle-{{$id}}" ng-disabled="disabled" type="checkbox" class="rp-toggle-hidden-input" ng-model="localModel" ng-change="onChange()" />
	<label for="rp-toggle-{{$id}}" class="rp-toggle-btn"></label>
</div>
"""
	