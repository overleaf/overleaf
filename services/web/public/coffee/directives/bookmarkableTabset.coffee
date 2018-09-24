define [
	"base"
], (App) ->
	App.directive "bookmarkableTabset", ($location, _) ->
		restrict: "A"
		require: "tabset"
		link: (scope, el, attrs, tabset) ->
			scope.$applyAsync () ->
				hash = $location.hash()
				if hash?
					matchingTab = _.find tabset.tabs, (tab) ->
						tab.bookmarkableTabId == hash
					if matchingTab?
						matchingTab.select()

	App.directive "bookmarkableTab", ($location) ->
		restrict: "A"
		require: "tab"
		link: (scope, el, attrs, tab) ->
			tabScope = el.isolateScope()
			tabId = attrs.bookmarkableTab
			if tabScope? and tabId? and tabId != ""
				tabScope.bookmarkableTabId = tabId
				tabScope.$watch "active", (isActive, wasActive) ->
					if isActive and !wasActive
						$location.hash tabId



