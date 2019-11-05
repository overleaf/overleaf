define(['base'], function(App) {
  App.directive('bookmarkableTabset', ($location, _) => ({
    restrict: 'A',
    require: 'tabset',
    link(scope, el, attrs, tabset) {
      const _makeActive = function(hash) {
        if (hash && hash !== '') {
          const matchingTab = _.find(
            tabset.tabs,
            tab => tab.bookmarkableTabId === hash
          )
          if (matchingTab) {
            matchingTab.select()
            return el.children()[0].scrollIntoView({ behavior: 'smooth' })
          }
        }
      }

      scope.$applyAsync(function() {
        // for page load
        const hash = $location.hash()
        _makeActive(hash)

        // for links within page to a tab
        // this needs to be within applyAsync because there could be a link
        // within a tab to another tab
        const linksToTabs = document.querySelectorAll('.link-to-tab')
        const _clickLinkToTab = event => {
          const hash = event.currentTarget
            .getAttribute('href')
            .split('#')
            .pop()
          _makeActive(hash)
        }

        if (linksToTabs) {
          Array.from(linksToTabs).map(link =>
            link.addEventListener('click', _clickLinkToTab)
          )
        }
      })
    }
  }))

  App.directive('bookmarkableTab', $location => ({
    restrict: 'A',
    require: 'tab',
    link(scope, el, attrs, tab) {
      const tabScope = el.isolateScope()
      const tabId = attrs.bookmarkableTab
      if (tabScope && tabId && tabId !== '') {
        tabScope.bookmarkableTabId = tabId
        tabScope.$watch('active', function(isActive, wasActive) {
          if (isActive && !wasActive && $location.hash() !== tabId) {
            return $location.hash(tabId)
          }
        })
      }
    }
  }))
})
