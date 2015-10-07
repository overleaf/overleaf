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
		"ErrorCatcher"
		"localStorage"
		"ngTagsInput"
	])

	return App
