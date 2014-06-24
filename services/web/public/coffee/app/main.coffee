define [
	"main/project-list"
	"main/user-details"
	"main/account-settings"
	"directives/asyncForm"
	"directives/stopPropagation"
	"directives/focus"
	"directives/equals"
	"directives/fineUpload"
	"directives/onEnter"
], () ->
	angular.bootstrap(document.body, ["SharelatexApp"])