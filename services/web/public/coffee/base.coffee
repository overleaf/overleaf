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
		"mvdSixpack"
		"ErrorCatcher"
		"localStorage"
		"ngTagsInput"
	]).config (sixpackProvider)->
		sixpackProvider.setOptions({
			debug: false
			baseUrl: window.sharelatex.sixpackDomain
			client_id: window.user_id
		})
	
	sl_debugging = window.location?.search?.match(/debug=true/)?
	window.sl_console =
		log: (args...) -> console.log(args...) if sl_debugging

	return App
