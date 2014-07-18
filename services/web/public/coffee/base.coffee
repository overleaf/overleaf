define [
	"libs"
	"modules/recursionHelper"
	"utils/underscore"
], () ->
	console.log "LOADING BASE"
	App = angular.module("SharelatexApp", [
		"ui.bootstrap"
		"autocomplete"
		"RecursionHelper"
		"ng-context-menu"
		"underscore"
		"ngSanitize"
	])

	return App