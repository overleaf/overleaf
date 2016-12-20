define [
	"base"
], (App) ->
	App.directive "reviewPanelToggle", () ->
		restrict: "E"
		scope: 
			innerModel: '=ngModel'
		template: """
<div class="rp-toggle">
	<input id="rp-toggle-{{$id}}" type="checkbox" class="rp-toggle-hidden-input" ng-model="innerModel" />
	<label for="rp-toggle-{{$id}}" class="rp-toggle-btn"></label>
</div>
"""
	