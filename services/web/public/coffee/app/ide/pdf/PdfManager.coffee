define [
	"ide/pdf/controllers/PdfController"
	"ide/pdf/directives/pdfJs"
], () ->
	class PdfManager
		constructor: (@ide, @$scope) ->
			@$scope.pdf =
				url: null # Pdf Url
				error: false # Server error
				timeout: false # Server timed out
				failure: false # PDF failed to compile
				compiling: false
				uncompiled: true
				logEntries: []
				logEntryAnnotations: {}
				rawLog: ""
				view: null # 'pdf' 'logs'
				showRawLog: false
				highlights: []
				position: null
