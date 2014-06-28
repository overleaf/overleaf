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
						console.log "Triggering", "layout:#{name}:resize", name
						scope.$broadcast "layout:#{name}:resize"
					#maskIframesOnResize: true

				# Restore previously recorded state
				if (state = $.localStorage("layout.#{name}"))?
					options.west = state.west
					options.east = state.east

				element.layout options
				element.layout().resizeAll()

				if attrs.resizeOn?
					scope.$on attrs.resizeOn, () -> element.layout().resizeAll()

				# Save state when exiting
				$(window).unload () ->
					$.localStorage("layout.#{name}", element.layout().readState())
		}