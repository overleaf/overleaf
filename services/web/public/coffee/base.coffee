define [
	"libs"
	"modules/recursionHelper"
	"modules/errorCatcher"
	"modules/localStorage"
	"utils/underscore"
], () ->
	App = angular.module("SharelatexApp", [
		"ui.bootstrap"
		"autocomplete"
		"RecursionHelper"
		"ng-context-menu"
		"underscore"
		"ngSanitize"
		"ipCookie"
		"mvdSixpack"
		"ErrorCatcher"
		"localStorage"
		"ngTagsInput"
	]).config (sixpackProvider)->
		sixpackProvider.setOptions({
			debug: false
			baseUrl: window.sharelatex.sixpackDomain
			client_id: window.user_id
		})

	App.controller "NavController", ($scope) ->

		$scope.toggleGroove = ->
			$scope['is-open'] = false
			$scope['isOpen'] = false
			GrooveWidget.toggle()



	return App
