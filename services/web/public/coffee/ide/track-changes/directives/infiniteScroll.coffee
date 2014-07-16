define [
	"base"
], (App) ->
	App.directive "infiniteScroll", () ->
		return {
			link: (scope, element, attrs, ctrl) ->
				innerElement = element.find(".infinite-scroll-inner")
				element.css 'overflow-y': 'auto'

				atEndOfListView = () ->
					if attrs.infiniteScrollUpwards?
						atTopOfListView()
					else
						atBottomOfList()
					
				atTopOfListView = () ->
					element.scrollTop() < 30
					
				atBottomOfListView = () ->
					element.scrollTop() + element.height() >= innerElement.height() - 30

				listShorterThanContainer = () ->
					element.height() > innerElement.height()

				loadUntilFull = () ->
					if (listShorterThanContainer() or atEndOfListView()) and not scope.$eval(attrs.infiniteScrollDisabled)
						promise = scope.$eval(attrs.infiniteScroll)
						promise.then () ->
							loadUntilFull()

				element.on "scroll", (event) ->
					loadUntilFull()

				scope.$watch attrs.infiniteScrollInitialize, (value) ->
					if value
						loadUntilFull()

		}