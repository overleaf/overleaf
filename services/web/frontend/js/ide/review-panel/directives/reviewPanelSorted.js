/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-undef,
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
define(['base'], App =>
  App.directive('reviewPanelSorted', $timeout => ({
    link(scope, element, attrs) {
      let previous_focused_entry_index = 0

      const layout = function(animate) {
        let entry,
          height,
          i,
          original_top,
          overflowTop,
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
        for (let el of Array.from(element.find('.rp-entry-wrapper'))) {
          entry = {
            $indicator_el: $(el).find('.rp-entry-indicator'),
            $box_el: $(el).find('.rp-entry'),
            $callout_el: $(el).find('.rp-entry-callout'),
            scope: angular.element(el).scope()
          }
          if (scope.ui.reviewPanelOpen) {
            entry.$layout_el = entry.$box_el
          } else {
            entry.$layout_el = entry.$indicator_el
          }
          entry.height = entry.$layout_el.height() // Do all of our DOM reads first for perfomance, see http://wilsonpage.co.uk/preventing-layout-thrashing/
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
        const entries_after = entries.slice(focused_entry_index + 1)
        const entries_before = entries.slice(0, focused_entry_index)
        const focused_entry = entries[focused_entry_index]
        previous_focused_entry_index = focused_entry_index

        sl_console.log('focused_entry_index', focused_entry_index)

        const positionLayoutEl = function($callout_el, original_top, top) {
          if (original_top <= top) {
            $callout_el.removeClass('rp-entry-callout-inverted')
            return $callout_el.css({
              top: original_top + line_height - 1,
              height: top - original_top
            })
          } else {
            $callout_el.addClass('rp-entry-callout-inverted')
            return $callout_el.css({
              top: top + line_height,
              height: original_top - top
            })
          }
        }

        // Put the focused entry as close to where it wants to be as possible
        const focused_entry_top = Math.max(
          focused_entry.scope.entry.screenPos.y,
          TOOLBAR_HEIGHT
        )
        focused_entry.$box_el.css({
          top: focused_entry_top,
          // The entry element is invisible by default, to avoid flickering when positioning for
          // the first time. Here we make sure it becomes visible after having a "top" value.
          visibility: 'visible'
        })
        focused_entry.$indicator_el.css({ top: focused_entry_top })
        positionLayoutEl(
          focused_entry.$callout_el,
          focused_entry.scope.entry.screenPos.y,
          focused_entry_top
        )

        let previousBottom =
          focused_entry_top + focused_entry.$layout_el.height()
        for (entry of Array.from(entries_after)) {
          original_top = entry.scope.entry.screenPos.y
          ;({ height } = entry)
          top = Math.max(original_top, previousBottom + PADDING)
          previousBottom = top + height
          entry.$box_el.css({
            top,
            // The entry element is invisible by default, to avoid flickering when positioning for
            // the first time. Here we make sure it becomes visible after having a "top" value.
            visibility: 'visible'
          })
          entry.$indicator_el.css({ top })
          positionLayoutEl(entry.$callout_el, original_top, top)
          sl_console.log('ENTRY', { entry: entry.scope.entry, top })
        }

        const lastBottom = previousBottom

        let previousTop = focused_entry_top
        entries_before.reverse() // Work through backwards, starting with the one just above
        for (i = 0; i < entries_before.length; i++) {
          entry = entries_before[i]
          original_top = entry.scope.entry.screenPos.y
          ;({ height } = entry)
          const original_bottom = original_top + height
          const bottom = Math.min(original_bottom, previousTop - PADDING)
          top = bottom - height
          previousTop = top
          entry.$box_el.css({
            top,
            // The entry element is invisible by default, to avoid flickering when positioning for
            // the first time. Here we make sure it becomes visible after having a "top" value.
            visibility: 'visible'
          })
          entry.$indicator_el.css({ top })
          positionLayoutEl(entry.$callout_el, original_top, top)
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
          height: previousBottom + OVERVIEW_TOGGLE_HEIGHT
        })
      }

      scope.$applyAsync(() => layout())

      scope.$on('review-panel:layout', function(e, animate) {
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
        .addMouseWheelListener(scroller[0], function(e) {
          const deltaY = e.wheelY
          const old_top = parseInt(list.css('top'))
          const top = old_top - deltaY * 4
          scrollAce(-top)
          return e.preventDefault()
        })

      // We always scroll by telling Ace to scroll and then updating the
      // review panel. This lets Ace manage the size of the scroller and
      // when it overflows.
      let ignoreNextAceEvent = false

      const scrollPanel = function(scrollTop, height) {
        if (ignoreNextAceEvent) {
          return (ignoreNextAceEvent = false)
        } else {
          const ignoreNextPanelEvent = true
          list.height(height)
          // console.log({height, scrollTop, top: height - scrollTop})
          return list.css({ top: -scrollTop })
        }
      }

      var scrollAce = scrollTop =>
        scope.reviewPanelEventsBridge.emit('externalScroll', scrollTop)

      scope.reviewPanelEventsBridge.on('aceScroll', scrollPanel)
      scope.$on('$destroy', () =>
        scope.reviewPanelEventsBridge.off('aceScroll')
      )

      return scope.reviewPanelEventsBridge.emit('refreshScrollPosition')
    }
  })))
