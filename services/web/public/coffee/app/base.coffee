define [
	"../libs/angular-autocomplete/angular-autocomplete"
	"../libs/ui-bootstrap"
	"modules/recursionHelper"
	"../libs/ng-context-menu-0.1.4"
	"utils/underscore"
], () ->

	App = angular.module("SharelatexApp", [
		"ui.bootstrap"
		"autocomplete"
		"RecursionHelper"
		"ng-context-menu"
		"underscore"
		"ngSanitize"
	])

	return App