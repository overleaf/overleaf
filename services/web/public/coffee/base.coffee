define [
	"libs"
	"modules/recursionHelper"
	"modules/errorCatcher"
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
	])

	return App
