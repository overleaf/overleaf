define [
	"../libs/angular-autocomplete/angular-autocomplete"
	"../libs/ui-bootstrap"
	"modules/recursionHelper"
], () ->
	App = angular.module("SharelatexApp", [
		"ui.bootstrap"
		"autocomplete"
		"RecursionHelper"
	])

	return App