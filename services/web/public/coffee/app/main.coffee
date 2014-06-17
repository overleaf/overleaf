define [
	"project-list"
	"user-details"
	"directives/asyncForm"
], () ->
	angular.bootstrap(document.getElementById("ng-app"), ["SharelatexApp"])
	$("#ng-app").show()
	$("#ng-app-loading").hide()