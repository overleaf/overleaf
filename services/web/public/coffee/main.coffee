define [
	"main/project-list"
	"main/user-details"
	"main/account-settings"
	"main/templates"
	"main/plans"
	"main/group-members"
	"main/scribtex-popup"
	"main/event-tracking"
	"directives/asyncForm"
	"directives/stopPropagation"
	"directives/focus"
	"directives/equals"
	"directives/fineUpload"
	"directives/onEnter"
	"directives/selectAll"
	"directives/maxHeight"
	"filters/formatDate"

], () ->
	angular.bootstrap(document.body, ["SharelatexApp"])
