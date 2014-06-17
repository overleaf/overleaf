define [
	"../libs/angular-autocomplete/angular-autocomplete"
	"../libs/ui-bootstrap"
], () ->
	App = angular.module("SharelatexApp", [
		"ui.bootstrap"
		"autocomplete"
	])

	return App