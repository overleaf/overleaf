define [
	"libraries"
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
		"ui.select"
	]).config ($qProvider, sixpackProvider, $httpProvider, uiSelectConfig) ->
		$qProvider.errorOnUnhandledRejections(false)
		uiSelectConfig.spinnerClass = 'fa fa-refresh ui-select-spin'
		sixpackProvider.setOptions({
			debug: false
			baseUrl: window.sharelatex.sixpackDomain
			client_id: window.user_id
		})

		MathJax?.Hub?.Config(
			extensions: ["Safe.js"]
			messageStyle: "none"
			imageFont:null
			"HTML-CSS": { availableFonts: ["TeX"] },
			TeX:
				equationNumbers: { autoNumber: "AMS" },
				useLabelIDs: false
			skipStartupTypeset: true
			tex2jax:
				processEscapes: true,
				inlineMath: [ ["\\(","\\)"] ],
				displayMath: [ ['$$','$$'], ["\\[","\\]"] ]
		)

	App.run ($templateCache) ->
		# UI Select templates are hard-coded and use Glyphicon icons (which we don't import). 
		# The line below simply overrides the hard-coded template with our own, which is 
		# basically the same but using Font Awesome icons.
		$templateCache.put "bootstrap/match.tpl.html", "<div class=\"ui-select-match\" ng-hide=\"$select.open && $select.searchEnabled\" ng-disabled=\"$select.disabled\" ng-class=\"{\'btn-default-focus\':$select.focus}\"><span tabindex=\"-1\" class=\"btn btn-default form-control ui-select-toggle\" aria-label=\"{{ $select.baseTitle }} activate\" ng-disabled=\"$select.disabled\" ng-click=\"$select.activate()\" style=\"outline: 0;\"><span ng-show=\"$select.isEmpty()\" class=\"ui-select-placeholder text-muted\">{{$select.placeholder}}</span> <span ng-hide=\"$select.isEmpty()\" class=\"ui-select-match-text pull-left\" ng-class=\"{\'ui-select-allow-clear\': $select.allowClear && !$select.isEmpty()}\" ng-transclude=\"\"></span> <i class=\"caret pull-right\" ng-click=\"$select.toggle($event)\"></i> <a ng-show=\"$select.allowClear && !$select.isEmpty() && ($select.disabled !== true)\" aria-label=\"{{ $select.baseTitle }} clear\" style=\"margin-right: 10px\" ng-click=\"$select.clear($event)\" class=\"btn btn-xs btn-link pull-right\"><i class=\"fa fa-times\" aria-hidden=\"true\"></i></a></span></div>"

	sl_debugging = window.location?.search?.match(/debug=true/)?
	window.sl_console =
		log: (args...) -> console.log(args...) if sl_debugging

	return App
