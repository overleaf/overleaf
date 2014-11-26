define [
	"libs"
	"modules/recursionHelper"
	"utils/underscore"
	# TODo move these into a separate definition
	"ide/pdfng/directives/pdfViewer"
	"ide/pdfng/directives/pdfPage"
	"ide/pdfng/directives/pdfRenderer"
	"ide/pdfng/directives/pdfTextLayer"
	"ide/pdfng/directives/pdfAnnotations"
	"ide/pdfng/directives/pdfHighlights"
], () ->
	App = angular.module("SharelatexApp", [
		"ui.bootstrap"
		"autocomplete"
		"RecursionHelper"
		"ng-context-menu"
		"underscore"
		"ngSanitize"
		"ipCookie"
		"pdfViewerApp"
	])

	return App
