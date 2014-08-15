define [
	"libs/underscore"
	"libs/backbone"
	"views/timeMessageBlockView"
	"moment"
	"https://c328740.ssl.cf1.rackcdn.com/mathjax/latest/MathJax.js?config=TeX-AMS_HTML"
], (_, Backbone, TimeMessageBlockView, moment) ->

	mathjaxConfig =
		"HTML-CSS": { availableFonts: ["TeX"] },
		TeX:
			equationNumbers: { autoNumber: "AMS" },
			useLabelIDs: false
		tex2jax:
			inlineMath: [ ['$','$'], ["\\(","\\)"] ],
			displayMath: [ ['$$','$$'], ["\\[","\\]"] ],
			processEscapes: true


	MathJax.Hub.Config(mathjaxConfig);



	UserMessageBlockView = Backbone.View.extend

		initialize: () ->
			@template = _.template($("#messageBlockTemplate").html())
			@user = @options.user
			@timeMessageBlock = new TimeMessageBlockView()
			@render()

		render: () ->
			@setElement $(@template(
				first_name:   @user.get("first_name")
				last_name:    @user.get("last_name")
				gravatar_url: @user.get("gravatar_url")
			))
			@$(".timeArea").html(@timeMessageBlock.$el)

		getTime: ->
			return @timeMessageBlock.timestamp

		appendMessage: (message) ->
			el = @buildHtml(message)
			@$(".messages").append(el)
			@_renderMathJax(el)
			@timeMessageBlock.setTimeOnce message.get("timestamp")

		prependMessage: (message) ->
			el = @buildHtml(message)
			@$(".messages").prepend(el)
			@_renderMathJax(el)
			@timeMessageBlock.setTime message.get("timestamp")

		buildHtml : (message)->
			time = moment(message.get("timestamp")).format("dddd, MMMM Do YYYY, h:mm:ss a")
			el = $("<div class='message' title='#{time}'>")
			el.text(message.get("content"))
			return el


		_renderMathJax: (element)->
			if element?
				MathJax.Hub.Queue(["Typeset", MathJax.Hub, element.get(0)])