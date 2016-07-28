define [
	"base"
], (App) ->
	App.factory 'pdfSpinner', [() ->

		class pdfSpinner

			constructor: () ->
				# handler for spinners

			add: (element, options) ->
				size = 64
				spinner = $('<div class="pdfng-spinner" style="position: absolute; top: 50%; left:50%; transform: translateX(-50%) translateY(-50%);"><i class="fa fa-spinner' + (if options?.static then '' else ' fa-spin') + '" style="color: #999"></i></div>')
				spinner.css({'font-size' : size + 'px'})
				element.append(spinner)

			start: (element) ->
				element.find('.fa-spinner').addClass('fa-spin')

			stop: (element) ->
				element.find('.fa-spinner').removeClass('fa-spin')

			remove: (element) ->
				element.find('.fa-spinner').remove()

		]
