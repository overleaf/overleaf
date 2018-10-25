define [
	"base"
], (App) ->
	App.directive "bookmarkableTabset", ($location, _) ->
		restrict: "A"
		require: "tabset"
		link: (scope, el, attrs, tabset) ->

			_makeActive = (hash) ->
				if hash? and hash != ""
					matchingTab = _.find tabset.tabs, (tab) ->
						tab.bookmarkableTabId == hash
					if matchingTab?
						matchingTab.select()
						el.children()[0].scrollIntoView({ behavior: "smooth" })

			scope.$applyAsync () ->
				# for page load
				hash = $location.hash()
				_makeActive(hash)

				# for links within page to a tab
				# this needs to be within applyAsync because there could be a link
				# within a tab to another tab
				linksToTabs = document.querySelectorAll(".link-to-tab");
				_clickLinkToTab = (event) ->
					_makeActive(event.currentTarget.getAttribute("href").replace('#', ''))

				if linksToTabs
					for link in linksToTabs
						link.addEventListener("click", _clickLinkToTab)

	App.directive "bookmarkableTab", ($location) ->
		restrict: "A"
		require: "tab"
		link: (scope, el, attrs, tab) ->
			tabScope = el.isolateScope()
			tabId = attrs.bookmarkableTab
			if tabScope? and tabId? and tabId != ""
				tabScope.bookmarkableTabId = tabId
				tabScope.$watch "active", (isActive, wasActive) ->
					if isActive and !wasActive and $location.hash() != tabId
						$location.hash tabId
