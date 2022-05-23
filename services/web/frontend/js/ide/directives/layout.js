/* eslint-disable
    max-len,
    no-return-assign,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../../base'
import _ from 'lodash'
import '../../vendor/libs/jquery-layout'
import '../../vendor/libs/jquery.ui.touch-punch'

export default App.directive('layout', ($parse, $compile, ide) => ({
  compile() {
    return {
      pre(scope, element, attrs) {
        let customTogglerEl, spacingClosed, spacingOpen, state
        const name = attrs.layout

        const { customTogglerPane } = attrs
        const { customTogglerMsgWhenOpen } = attrs
        const { customTogglerMsgWhenClosed } = attrs
        const hasCustomToggler =
          customTogglerPane != null &&
          customTogglerMsgWhenOpen != null &&
          customTogglerMsgWhenClosed != null

        if (attrs.spacingOpen != null) {
          spacingOpen = parseInt(attrs.spacingOpen, 10)
        } else {
          spacingOpen = 7
        }

        if (attrs.spacingClosed != null) {
          spacingClosed = parseInt(attrs.spacingClosed, 10)
        } else {
          spacingClosed = 7
        }

        const options = {
          spacing_open: spacingOpen,
          spacing_closed: spacingClosed,
          slidable: false,
          enableCursorHotkey: false,
          onopen: pane => {
            return onPaneOpen(pane)
          },
          onclose: pane => {
            return onPaneClose(pane)
          },
          onresize: () => {
            return onInternalResize()
          },
          maskIframesOnResize: scope.$eval(
            attrs.maskIframesOnResize || 'false'
          ),
          east: {
            size: scope.$eval(attrs.initialSizeEast),
            initClosed: scope.$eval(attrs.initClosedEast),
          },
          west: {
            size: scope.$eval(attrs.initialSizeWest),
            initClosed: scope.$eval(attrs.initClosedWest),
          },
        }

        // Restore previously recorded state
        if ((state = ide.localStorage(`layout.${name}`)) != null) {
          if (state.east != null) {
            if (
              attrs.minimumRestoreSizeEast == null ||
              (state.east.size >= attrs.minimumRestoreSizeEast &&
                !state.east.initClosed)
            ) {
              options.east = state.east
            }
            options.east.initClosed = state.east.initClosed
          }
          if (state.west != null) {
            if (
              attrs.minimumRestoreSizeWest == null ||
              (state.west.size >= attrs.minimumRestoreSizeWest &&
                !state.west.initClosed)
            ) {
              options.west = state.west
            }
            // NOTE: disabled so that the file tree re-opens on page load
            // options.west.initClosed = state.west.initClosed
          }
        }

        options.east.resizerCursor = 'ew-resize'
        options.west.resizerCursor = 'ew-resize'

        function repositionControls() {
          state = layout.readState()
          if (state.east != null) {
            const controls = element.find('> .ui-layout-resizer-controls')
            if (state.east.initClosed) {
              return controls.hide()
            } else {
              controls.show()
              return controls.css({
                right: state.east.size,
              })
            }
          }
        }

        function repositionCustomToggler() {
          if (customTogglerEl == null) {
            return
          }
          state = layout.readState()
          const positionAnchor = customTogglerPane === 'east' ? 'right' : 'left'
          const paneState = state[customTogglerPane]
          if (paneState != null) {
            return customTogglerEl.css(
              positionAnchor,
              paneState.initClosed ? 0 : paneState.size
            )
          }
        }

        function resetOpenStates() {
          state = layout.readState()
          if (attrs.openEast != null && state.east != null) {
            const openEast = $parse(attrs.openEast)
            return openEast.assign(scope, !state.east.initClosed)
          }
        }

        // Someone moved the resizer
        function onInternalResize() {
          state = layout.readState()
          scope.$broadcast(`layout:${name}:resize`, state)
          repositionControls()
          if (hasCustomToggler) {
            repositionCustomToggler()
          }
          return resetOpenStates()
        }

        let oldWidth = element.width()
        // Something resized our parent element
        const onExternalResize = function () {
          if (
            attrs.resizeProportionally != null &&
            scope.$eval(attrs.resizeProportionally)
          ) {
            const eastState = layout.readState().east
            if (eastState != null) {
              const currentWidth = element.width()
              if (currentWidth > 0) {
                const newInternalWidth =
                  (eastState.size / oldWidth) * currentWidth
                oldWidth = currentWidth
                layout.sizePane('east', newInternalWidth)
              }
              return
            }
          }

          ide.$timeout(() => {
            layout.resizeAll()
          })
        }

        const layout = element.layout(options)
        layout.resizeAll()

        if (attrs.resizeOn != null) {
          for (const event of Array.from(attrs.resizeOn.split(','))) {
            scope.$on(event, () => onExternalResize())
          }
        }

        if (hasCustomToggler) {
          state = layout.readState()
          const customTogglerScope = scope.$new()

          customTogglerScope.isOpen = true
          customTogglerScope.isVisible = true

          if (
            (state[customTogglerPane] != null
              ? state[customTogglerPane].initClosed
              : undefined) === true
          ) {
            customTogglerScope.isOpen = false
          }

          customTogglerScope.tooltipMsgWhenOpen = customTogglerMsgWhenOpen
          customTogglerScope.tooltipMsgWhenClosed = customTogglerMsgWhenClosed

          customTogglerScope.tooltipPlacement =
            customTogglerPane === 'east' ? 'left' : 'right'
          customTogglerScope.handleClick = function () {
            layout.toggle(customTogglerPane)
            return repositionCustomToggler()
          }
          customTogglerEl = $compile(`\
<a href \
ng-show=\"isVisible\" \
class=\"custom-toggler ${`custom-toggler-${customTogglerPane}`}\" \
ng-class=\"isOpen ? 'custom-toggler-open' : 'custom-toggler-closed'\" \
tooltip=\"{{ isOpen ? tooltipMsgWhenOpen : tooltipMsgWhenClosed }}\" \
tooltip-placement=\"{{ tooltipPlacement }}\" \
ng-click=\"handleClick()\">\
`)(customTogglerScope)
          element.append(customTogglerEl)
        }

        function onPaneOpen(pane) {
          if (!hasCustomToggler && pane !== customTogglerPane) {
            return
          }
          return customTogglerEl
            .scope()
            .$applyAsync(() => (customTogglerEl.scope().isOpen = true))
        }

        function onPaneClose(pane) {
          if (!hasCustomToggler && pane !== customTogglerPane) {
            return
          }
          return customTogglerEl
            .scope()
            .$applyAsync(() => (customTogglerEl.scope().isOpen = false))
        }

        // Save state when exiting
        $(window).unload(() => {
          // Save only the state properties for the current layout, ignoring sublayouts inside it.
          // If we save sublayouts state (`children`), the layout library will use it when
          // initializing. This raises errors when the sublayout elements aren't available (due to
          // being loaded at init or just not existing for the current project/user).
          const stateToSave = _.mapValues(layout.readState(), pane =>
            _.omit(pane, 'children')
          )
          ide.localStorage(`layout.${name}`, stateToSave)
        })

        if (attrs.openEast != null) {
          scope.$watch(attrs.openEast, function (value, oldValue) {
            if (value != null && value !== oldValue) {
              if (value) {
                layout.open('east')
              } else {
                layout.close('east')
              }
              if (hasCustomToggler) {
                repositionCustomToggler()
                customTogglerEl.scope().$applyAsync(function () {
                  customTogglerEl.scope().isOpen = value
                })
              }
            }
            return setTimeout(() => scope.$digest(), 0)
          })
        }

        if (attrs.allowOverflowOn != null) {
          const overflowPane = scope.$eval(attrs.allowOverflowOn)
          const overflowPaneEl = layout.panes[overflowPane]
          // Set the panel as overflowing (gives it higher z-index and sets overflow rules)
          layout.allowOverflow(overflowPane)
          // Read the given z-index value and increment it, so that it's higher than synctex controls.
          const overflowPaneZVal = overflowPaneEl.zIndex()
          overflowPaneEl.css('z-index', overflowPaneZVal + 1)
        }

        resetOpenStates()
        onInternalResize()

        if (attrs.layoutDisabled != null) {
          return scope.$watch(attrs.layoutDisabled, function (value) {
            if (value) {
              layout.hide('east')
            } else {
              layout.show('east')
            }
            if (hasCustomToggler) {
              return customTogglerEl.scope().$applyAsync(function () {
                customTogglerEl.scope().isOpen = !value
                return (customTogglerEl.scope().isVisible = !value)
              })
            }
          })
        }
      },

      post(scope, element, attrs) {
        const name = attrs.layout
        const state = element.layout().readState()
        return scope.$broadcast(`layout:${name}:linked`, state)
      },
    }
  },
}))
