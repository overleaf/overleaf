define [
	"base"
	"libs/jquery-layout"
], (App) ->
	App.directive "layout", ["$parse", "ide", ($parse, ide) ->
		return {
			compile: () ->
				pre: (scope, element, attrs) ->
					name = attrs.layout

					if attrs.spacingOpen?
						spacingOpen = parseInt(attrs.spacingOpen, 10)
					else
						spacingOpen = 24

					if attrs.spacingClosed?
						spacingClosed = parseInt(attrs.spacingClosed, 10)
					else
						spacingClosed = 24

					options =
						spacing_open: spacingOpen
						spacing_closed: spacingClosed
						slidable: false
						enableCursorHotkey: false
						onresize: () =>
							onInternalResize()
						maskIframesOnResize: scope.$eval(
							attrs.maskIframesOnResize or "false"
						)
						east:
							size: scope.$eval(attrs.initialSizeEast)
							initClosed: scope.$eval(attrs.initClosedEast)
						west:
							size: scope.$eval(attrs.initialSizeEast)
							initClosed: scope.$eval(attrs.initClosedWest)

					# Restore previously recorded state
					if (state = ide.localStorage("layout.#{name}"))?
						if state.east?
							if !attrs.minimumRestoreSizeEast? or (state.east.size >= attrs.minimumRestoreSizeEast and !state.east.initClosed)
								options.east = state.east
						if state.west?
							if !attrs.minimumRestoreSizeWest? or (state.west.size >= attrs.minimumRestoreSizeWest and !state.west.initClosed)
								options.west = state.west

					repositionControls = () ->
						state = element.layout().readState()
						if state.east?
							controls = element.find("> .ui-layout-resizer-controls")
							if state.east.initClosed
								controls.hide()
							else
								controls.show()
								controls.css({
									position: "absolute"
									right: state.east.size
									"z-index": 10
								})

					resetOpenStates = () ->
						state = element.layout().readState()
						if attrs.openEast? and state.east?
							openEast = $parse(attrs.openEast)
							openEast.assign(scope, !state.east.initClosed)

					# Someone moved the resizer
					onInternalResize = () ->
						state = element.layout().readState()
						scope.$broadcast "layout:#{name}:resize", state
						repositionControls()
						resetOpenStates()
						
					oldWidth = element.width()
					# Something resized our parent element
					onExternalResize = () ->
						if attrs.resizeProportionally? and scope.$eval(attrs.resizeProportionally)
							eastState = element.layout().readState().east
							if eastState?
								newInternalWidth = eastState.size / oldWidth * element.width()
								oldWidth = element.width()
								element.layout().sizePane("east", newInternalWidth)
								return
							
						element.layout().resizeAll()

					element.layout options
					element.layout().resizeAll()

					if attrs.resizeOn?
						scope.$on attrs.resizeOn, () -> onExternalResize()

					# Save state when exiting
					$(window).unload () ->
						ide.localStorage("layout.#{name}", element.layout().readState())



					if attrs.openEast?
						scope.$watch attrs.openEast, (value, oldValue) ->
							if value? and value != oldValue
								if value
									element.layout().open("east")
								else
									element.layout().close("east")
							setTimeout () ->
								scope.$digest()
							, 0

					resetOpenStates()
					onInternalResize()

					if attrs.layoutDisabled?
						scope.$watch attrs.layoutDisabled, (value) ->
							if value
								element.layout().hide("east")
							else
								element.layout().show("east")
		}
	]
