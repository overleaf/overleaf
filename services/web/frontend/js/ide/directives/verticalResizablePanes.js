import App from '../../base'

const layoutOptions = {
  center: {
    paneSelector: '[vertical-resizable-top]',
    paneClass: 'vertical-resizable-top',
    size: 'auto',
  },
  south: {
    paneSelector: '[vertical-resizable-bottom]',
    paneClass: 'vertical-resizable-bottom',
    resizerClass: 'vertical-resizable-resizer',
    resizerCursor: 'ns-resize',
    size: 'auto',
    resizable: true,
    closable: false,
    slidable: false,
    spacing_open: 6,
    spacing_closed: 6,
    maxSize: '75%',
  },
}

export default App.directive('verticalResizablePanes', (localStorage, ide) => ({
  restrict: 'A',
  link(scope, element, attrs) {
    const name = attrs.verticalResizablePanes
    const minSize = attrs.verticalResizablePanesMinSize
    const maxSize = attrs.verticalResizablePanesMaxSize
    const defaultSize = attrs.verticalResizablePanesDefaultSize
    let storedSize = null
    let manualResizeIncoming = false

    if (name) {
      const storageKey = `vertical-resizable:${name}:south-size`
      storedSize = localStorage(storageKey)
      $(window).unload(() => {
        if (storedSize) {
          localStorage(storageKey, storedSize)
        }
      })
    }

    const toggledExternally = attrs.verticalResizablePanesToggledExternallyOn
    const hiddenExternally = attrs.verticalResizablePanesHiddenExternallyOn
    const hiddenInitially = attrs.verticalResizablePanesHiddenInitially
    const resizeOn = attrs.verticalResizablePanesResizeOn
    const resizerDisabledClass = `${layoutOptions.south.resizerClass}-disabled`

    function enableResizer() {
      if (layoutHandle.resizers && layoutHandle.resizers.south) {
        layoutHandle.resizers.south.removeClass(resizerDisabledClass)
      }
    }

    function disableResizer() {
      if (layoutHandle.resizers && layoutHandle.resizers.south) {
        layoutHandle.resizers.south.addClass(resizerDisabledClass)
      }
    }

    function handleDragEnd() {
      manualResizeIncoming = true
    }

    function handleResize(paneName, paneEl, paneState) {
      if (manualResizeIncoming) {
        storedSize = paneState.size
      }
      manualResizeIncoming = false
    }

    if (toggledExternally) {
      scope.$on(toggledExternally, (e, open) => {
        let newSize = 'auto'
        if (open) {
          if (storedSize) {
            newSize = storedSize
          }
          enableResizer()
        } else {
          disableResizer()
        }
        layoutHandle.sizePane('south', newSize)
      })
    }

    if (hiddenExternally) {
      ide.$scope.$on(hiddenExternally, (e, open) => {
        if (open) {
          layoutHandle.show('south')
        } else {
          layoutHandle.hide('south')
        }
      })
    }

    if (resizeOn) {
      ide.$scope.$on(resizeOn, () => {
        ide.$timeout(() => {
          layoutHandle.resizeAll()
        })
      })
    }

    if (maxSize) {
      layoutOptions.south.maxSize = maxSize
    }

    if (minSize) {
      layoutOptions.south.minSize = minSize
    }

    if (defaultSize) {
      layoutOptions.south.size = defaultSize
    }

    // The `drag` event fires only when the user manually resizes the panes; the `resize` event fires even when
    // the layout library internally resizes itself. In order to get explicit user-initiated resizes, we need to
    // listen to `drag` events. However, when the `drag` event fires, the panes aren't yet finished sizing so we
    // get the pane size *before* the resize happens. We do get the correct size in the next `resize` event.
    // The solution to work around this is to set up a flag in `drag` events which tells the next `resize` event
    // that it was user-initiated (therefore, storing the value).
    layoutOptions.south.ondrag_end = handleDragEnd
    layoutOptions.south.onresize = handleResize

    const layoutHandle = element.layout(layoutOptions)
    if (hiddenInitially === 'true') {
      layoutHandle.hide('south')
    }
  },
}))
