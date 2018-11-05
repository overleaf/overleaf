/* eslint-disable
    max-len,
    no-undef,
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
define(['base'], function(App) {
  App.directive('bookmarkableTabset', ($location, _) => ({
    restrict: 'A',
    require: 'tabset',
    link(scope, el, attrs, tabset) {
      const _makeActive = function(hash) {
        if (hash != null && hash !== '') {
          const matchingTab = _.find(
            tabset.tabs,
            tab => tab.bookmarkableTabId === hash
          )
          if (matchingTab != null) {
            matchingTab.select()
            return el.children()[0].scrollIntoView({ behavior: 'smooth' })
          }
        }
      }

      return scope.$applyAsync(function() {
        // for page load
        const hash = $location.hash()
        _makeActive(hash)

        // for links within page to a tab
        // this needs to be within applyAsync because there could be a link
        // within a tab to another tab
        const linksToTabs = document.querySelectorAll('.link-to-tab')
        const _clickLinkToTab = event =>
          _makeActive(event.currentTarget.getAttribute('href').replace('#', ''))

        if (linksToTabs) {
          return Array.from(linksToTabs).map(link =>
            link.addEventListener('click', _clickLinkToTab)
          )
        }
      })
    }
  }))

  return App.directive('bookmarkableTab', $location => ({
    restrict: 'A',
    require: 'tab',
    link(scope, el, attrs, tab) {
      const tabScope = el.isolateScope()
      const tabId = attrs.bookmarkableTab
      if (tabScope != null && tabId != null && tabId !== '') {
        tabScope.bookmarkableTabId = tabId
        return tabScope.$watch('active', function(isActive, wasActive) {
          if (isActive && !wasActive && $location.hash() !== tabId) {
            return $location.hash(tabId)
          }
        })
      }
    }
  }))
})
