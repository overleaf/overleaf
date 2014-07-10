define [
	"base"
], (App) ->
	App.directive "infiniteScroll", () ->
		return {
			link: (scope, element, attrs, ctrl) ->
				innerElement = element.find(".infinite-scroll-inner")
				element.css 'overflow-y': 'auto'

				atEndOfListView = () ->
					element.scrollTop() + element.height() >= innerElement.height() - 30

				listShorterThanContainer = () ->
					element.innerHeight() > @$(".change-list").outerHeight()

				loadUntilFull = () ->
					if (listShorterThanContainer() or atEndOfListView()) and not scope.$eval(attrs.infiniteScrollDisabled)
						promise = scope.$eval(attrs.infiniteScroll)
						promise.then () ->
							loadUntilFull()
						# @collection.fetchNextBatch
						# 	error: (error) =>
						# 		@hideLoading()
						# 		@showEmptyMessageIfCollectionEmpty()
						# 		callback(error)
						# 	success: (collection, response) =>
						# 		@hideLoading()
						# 		if @collection.isAtEnd()
						# 			@atEndOfCollection = true
						# 			@showEmptyMessageIfCollectionEmpty()
						# 			callback()
						# 		else
						# 			@loadUntilFull(callback)

				element.on "scroll", (event) ->
					loadUntilFull()

				scope.$watch attrs.infiniteScrollInitialize, (value) ->
					if value
						loadUntilFull()

		}