define [
	"libs/backbone"
	"libs/mustache"
], () ->
	MenuView = Backbone.View.extend
		tagName: "ul"
		className: "auto-complete-menu"

		templates:
			suggestion: $("#autoCompleteSuggestionTemplate").html()

		render: (fontFamily, fontSize) ->
			@$el.css
				position: "absolute"
				"font-family": fontFamily
				"font-size": fontSize
			return @$el

		setSuggestions: (suggestions) ->
			@$el.children().off()
			@$el.empty()
			@suggestions = []
			for suggestion in suggestions
				do (suggestion) =>
					el = $(Mustache.to_html(@templates.suggestion, suggestion))
					@$el.append(el)
					el.on "click", (e) => @trigger("click", e, suggestion)
					@suggestions.push suggestion: suggestion, el: el
			@selectSuggestionAtIndex 0

		selectSuggestionAtIndex: (index) ->
			if index >= 0 and index < @suggestions.length
				@$("li").removeClass "selected"
				@suggestions[index].el.addClass "selected"
				@selectedIndex = index

		moveSelectionDown: () ->
			if @selectedIndex? and @selectedIndex < @suggestions.length - 1
				@selectSuggestionAtIndex @selectedIndex + 1

		moveSelectionUp: () ->
			if @selectedIndex? and @selectedIndex > 0
				@selectSuggestionAtIndex @selectedIndex - 1

		getSelectedSuggestion: () ->
			if @selectedIndex? and @suggestions[@selectedIndex]?
				@suggestions[@selectedIndex].suggestion

		position: (pos) ->
			@$el.css
				top: pos.top
				left: pos.left

		show: () -> @$el.show()
		hide: () -> @$el.hide()


