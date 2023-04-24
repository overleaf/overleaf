/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-unused-vars,
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
import App from '../../../base'

export default App.directive('reviewPanelSorted', $timeout => ({
  link(scope, element, attrs) {
    let previous_focused_entry_index = 0

    const applyEntryVisibility = function (entry) {
      const visible = entry.scope.entry.screenPos
      if (visible) {
        entry.$wrapper_el.removeClass('rp-entry-hidden')
      } else {
        entry.$wrapper_el.addClass('rp-entry-hidden')
      }
      return visible
    }

    const layout = function (animate) {
      let entry,
        height,
        i,
        original_top,
        overflowTop,
        screenPosHeight,
        OVERVIEW_TOGGLE_HEIGHT,
        PADDING,
        TOOLBAR_HEIGHT,
        top
      if (animate == null) {
        animate = true
      }
      if (animate) {
        element.removeClass('no-animate')
      } else {
        element.addClass('no-animate')
      }
      if (scope.ui.reviewPanelOpen) {
        PADDING = 8
        TOOLBAR_HEIGHT = 38
        OVERVIEW_TOGGLE_HEIGHT = 57
      } else {
        PADDING = 4
        TOOLBAR_HEIGHT = 4
        OVERVIEW_TOGGLE_HEIGHT = 0
      }

      const entries = []
      for (const el of Array.from(element.find('.rp-entry-wrapper'))) {
        entry = {
          $wrapper_el: $(el),
          $indicator_el: $(el).find('.rp-entry-indicator'),
          $box_el: $(el).find('.rp-entry'),
          $callout_el: $(el).find('.rp-entry-callout'),
          scope: angular.element(el).scope(),
        }
        if (scope.ui.reviewPanelOpen) {
          entry.$layout_el = entry.$box_el
        } else {
          entry.$layout_el = entry.$indicator_el
        }
        entry.height = entry.$layout_el.height() // Do all of our DOM reads first for performance, see http://wilsonpage.co.uk/preventing-layout-thrashing/
        entries.push(entry)
      }
      entries.sort((a, b) => a.scope.entry.offset - b.scope.entry.offset)

      if (entries.length === 0) {
        return
      }

      const line_height = scope.reviewPanel.rendererData.lineHeight

      let focused_entry_index = Math.min(
        previous_focused_entry_index,
        entries.length - 1
      )
      for (i = 0; i < entries.length; i++) {
        entry = entries[i]
        if (entry.scope.entry.focused) {
          focused_entry_index = i
          break
        }
      }

      const focused_entry = entries[focused_entry_index]
      const focusedEntryVisible = applyEntryVisibility(focused_entry)

      // If the focused entry has no screenPos, we can't position other entries
      // relative to it, so we position all other entries as though the focused
      // entry is at the top and they all follow it
      const entries_after = focusedEntryVisible
        ? entries.slice(focused_entry_index + 1)
        : [...entries]
      const entries_before = focusedEntryVisible
        ? entries.slice(0, focused_entry_index)
        : []
      previous_focused_entry_index = focused_entry_index

      sl_console.log('focused_entry_index', focused_entry_index)

      const positionLayoutEl = function (
        $callout_el,
        original_top,
        top,
        height
      ) {
        if (original_top <= top) {
          $callout_el.removeClass('rp-entry-callout-inverted')
          return $callout_el.css({
            top: original_top + height - 1,
            height: top - original_top,
          })
        } else {
          $callout_el.addClass('rp-entry-callout-inverted')
          return $callout_el.css({
            top: top + height,
            height: original_top - top,
          })
        }
      }

      // Put the focused entry as close to where it wants to be as possible
      let focused_entry_top = 0
      let previousBottom = 0

      if (focusedEntryVisible) {
        const focusedEntryScreenPos = focused_entry.scope.entry.screenPos
        focused_entry_top = Math.max(focusedEntryScreenPos.y, TOOLBAR_HEIGHT)
        focused_entry.$box_el.css({
          top: focused_entry_top,
          // The entry element is invisible by default, to avoid flickering when positioning for
          // the first time. Here we make sure it becomes visible after having a "top" value.
          visibility: 'visible',
        })
        focused_entry.$indicator_el.css({ top: focused_entry_top })
        // use screenPos.height if set
        screenPosHeight = focusedEntryScreenPos.height ?? line_height
        positionLayoutEl(
          focused_entry.$callout_el,
          focusedEntryScreenPos.y,
          focused_entry_top,
          screenPosHeight
        )
        previousBottom = focused_entry_top + focused_entry.$layout_el.height()
      }

      for (entry of entries_after) {
        const entryVisible = applyEntryVisibility(entry)
        if (entryVisible) {
          original_top = entry.scope.entry.screenPos.y
          // use screenPos.height if set
          screenPosHeight = entry.scope.entry.screenPos.height ?? line_height
          ;({ height } = entry)
          top = Math.max(original_top, previousBottom + PADDING)
          previousBottom = top + height
          entry.$box_el.css({
            top,
            // The entry element is invisible by default, to avoid flickering when positioning for
            // the first time. Here we make sure it becomes visible after having a "top" value.
            visibility: 'visible',
          })
          entry.$indicator_el.css({ top })
          positionLayoutEl(
            entry.$callout_el,
            original_top,
            top,
            screenPosHeight
          )
        }
        sl_console.log('ENTRY', { entry: entry.scope.entry, top })
      }

      let previousTop = focused_entry_top
      entries_before.reverse() // Work through backwards, starting with the one just above
      for (entry of entries_before) {
        const entryVisible = applyEntryVisibility(entry)
        if (entryVisible) {
          original_top = entry.scope.entry.screenPos.y
          // use screenPos.height if set
          screenPosHeight = entry.scope.entry.screenPos.height ?? line_height
          ;({ height } = entry)
          const original_bottom = original_top + height
          const bottom = Math.min(original_bottom, previousTop - PADDING)
          top = bottom - height
          previousTop = top
          entry.$box_el.css({
            top,
            // The entry element is invisible by default, to avoid flickering when positioning for
            // the first time. Here we make sure it becomes visible after having a "top" value.
            visibility: 'visible',
          })
          entry.$indicator_el.css({ top })
          positionLayoutEl(
            entry.$callout_el,
            original_top,
            top,
            screenPosHeight
          )
        }
        sl_console.log('ENTRY', { entry: entry.scope.entry, top })
      }

      const lastTop = top
      if (lastTop < TOOLBAR_HEIGHT) {
        overflowTop = -lastTop + TOOLBAR_HEIGHT
      } else {
        overflowTop = 0
      }

      return scope.$emit('review-panel:sizes', {
        overflowTop,
        height: previousBottom + OVERVIEW_TOGGLE_HEIGHT,
      })
    }

    scope.$applyAsync(() => layout())

    scope.$on('review-panel:layout', function (e, animate) {
      if (animate == null) {
        animate = true
      }
      return scope.$applyAsync(() => layout(animate))
    })

    scope.$watch('reviewPanel.rendererData.lineHeight', () => layout())

    // # Scroll lock with Ace
    const scroller = element
    const list = element.find('.rp-entry-list-inner')

    // If we listen for scroll events in the review panel natively, then with a Mac trackpad
    // the scroll is very smooth (natively done I'd guess), but we don't get polled regularly
    // enough to keep Ace in step, and it noticeably lags. If instead, we borrow the manual
    // mousewheel/trackpad scrolling behaviour from Ace, and turn mousewheel events into
    // scroll events ourselves, then it makes the review panel slightly less smooth (barely)
    // noticeable, but keeps it perfectly in step with Ace.
    ace
      .require('ace/lib/event')
      .addMouseWheelListener(scroller[0], function (e) {
        const deltaY = e.wheelY
        const old_top = parseInt(list.css('top'))
        const top = old_top - deltaY * 4
        scrollAce(-top)
        dispatchScrollEvent(deltaY * 4)
        return e.preventDefault()
      })

    // We always scroll by telling Ace to scroll and then updating the
    // review panel. This lets Ace manage the size of the scroller and
    // when it overflows.
    let ignoreNextAceEvent = false

    const scrollPanel = function (scrollTop, height) {
      if (ignoreNextAceEvent) {
        return (ignoreNextAceEvent = false)
      } else {
        list.height(height)
        // console.log({height, scrollTop, top: height - scrollTop})
        return list.css({ top: -scrollTop })
      }
    }

    const scrollAce = scrollTop =>
      scope.reviewPanelEventsBridge.emit('externalScroll', scrollTop)

    scope.reviewPanelEventsBridge.on('aceScroll', scrollPanel)
    scope.$on('$destroy', () => scope.reviewPanelEventsBridge.off('aceScroll'))

    // receive the scroll position from the CodeMirror 6 track changes extension
    window.addEventListener('editor:scroll', event => {
      const { scrollTop, height, paddingTop } = event.detail

      scrollPanel(scrollTop - paddingTop, height)
    })

    // Send scroll delta to the CodeMirror 6 track changes extension
    const dispatchScrollEvent = scrollTopDelta => {
      window.dispatchEvent(
        new CustomEvent('review-panel:event', {
          detail: { type: 'scroll', payload: scrollTopDelta },
        })
      )
    }

    return scope.reviewPanelEventsBridge.emit('refreshScrollPosition')
  },
}))
