define [
	"main/project-list"
	"main/user-details"
	"main/account-settings"
	"main/plans"
	"main/group-members"
	"directives/asyncForm"
	"directives/stopPropagation"
	"directives/focus"
	"directives/equals"
	"directives/fineUpload"
	"directives/onEnter"
	"directives/selectAll"
	"filters/formatDate"
], () ->
	angular.bootstrap(document.body, ["SharelatexApp"])