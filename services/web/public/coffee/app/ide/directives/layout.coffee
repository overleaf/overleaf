define [
	"base"
], (App) ->
	App.directive "layout", () ->
		return {
			link: (scope, element, attrs) ->
				name = attrs.layout

				options =
					spacing_open: 24
					spacing_closed: 24
					onresize: () =>
						scope.$broadcast "layout:#{name}:resize"

				# Restore previously recorded state
				if (state = $.localStorage("layout.main"))?
					options.west = state.west
					options.east = state.east

				$(element).layout options

				# Save state when exiting
				$(window).unload () ->
					$.localStorage("layout.#{name}", element.layout().readState())
		}