define [
	"libs/underscore"
	"libs/backbone"
	"moment"
], (_, Backbone, moment) ->
	ONE_WEEK = 7 * 24 * 60 * 60 * 1000

	TimeMessageBlockView = Backbone.View.extend
	
		className : "timeSinceMessage"

		initialize: () ->
			@autoRefresh()
		
		setTimeOnce: (timestamp)->
			if !@timestamp?
				@timestamp = timestamp
				@render()
			return @

		setTime: (@timestamp)->
			@render()
			return @

		autoRefresh: ->
			if @timestamp?
				@render()
			self = @
			doIt = =>
				self.autoRefresh()
			setTimeout doIt, 60 * 1000

		render: () ->
			milisecondsSince = new Date().getTime() - @timestamp
			if  milisecondsSince > ONE_WEEK
				time = moment(@timestamp).format("D/MMM/YY, h:mm:ss a")
			else
				time =  moment(@timestamp).fromNow()
			this.$el.html(time)

