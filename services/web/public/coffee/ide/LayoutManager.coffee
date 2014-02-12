define [
	"underscore",
	"libs/backbone",
	"libs/jquery-layout"
	"libs/jquery.storage"
], () ->
	class LayoutManager
		constructor: (@ide) ->
			_.extend @, Backbone.Events

			template = $("#editorLayoutTemplate").html()
			el = $(template)
			@ide.tabManager.addTab {
				id: "code"
				name: "Code"
				content: el
				active: true
				contract: true
				onShown: () =>
					@resizeAllSplitters()
			}

			$(window).resize () =>
				@refreshHeights()

			@refreshHeights()

			@initLayout()
					
			$(window).keypress (event)->
				if (!(event.which == 115 && event.ctrlKey) && !(event.which == 19))
					return true
				event.preventDefault()
				return false

			@refreshHeights()

		initLayout: () ->
			options =
				spacing_open: 8
				spacing_closed: 16
				onresize: () =>
					@.trigger("resize")
			
			if (state = $.localStorage("layout.main"))?
				options.west =
					state.west

			$("#mainSplitter").layout options

			$(window).unload () ->
				$.localStorage("layout.main", $("#mainSplitter").layout().readState())

		refreshHeights: ->
			@setSplitterHeight()
			@setSectionsHeight()
			@setTopOffset()

		setSplitterHeight: () ->
			$("#mainSplitter").height($(window).height() - $(".navbar").outerHeight())

		setTopOffset: () ->
			$("#toolbar").css(top: $(".navbar").outerHeight())
			$("#tab-content").css(top: $(".navbar").outerHeight())
			
		setSectionsHeight: ()->
			$sections = $('#sections')
			$chatArea = $('#chatArea')
			availableSpace = $(window).height() - 40 - 20 - 10
			if $chatArea.is(':visible')
				availableSpace -= 200
			$sections.height(availableSpace)

		resizeAllSplitters : ->
			$("#mainSplitter").layout().resizeAll()
			$("#editorSplitter").layout().resizeAll()
