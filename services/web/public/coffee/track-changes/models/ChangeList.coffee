define [
	"track-changes/models/Change"
	"libs/backbone"
], (Change)->
	ChangeList = Backbone.Collection.extend
		model: Change
		batchSize: 10

		initialize: (models, @options) ->
			@ide = @options.ide
			@atEnd = false

		url: () ->
			url = "/project/#{@options.project_id}/updates?min_count=#{@batchSize}"
			if @nextBeforeTimestamp?
				url += "&before=#{@nextBeforeTimestamp}"
			return url

		isAtEnd: () -> @atEnd

		parse: (json) ->
			@nextBeforeTimestamp = json.nextBeforeTimestamp
			@atEnd = !@nextBeforeTimestamp
			return json.updates

		fetchNextBatch: (options = {}) ->
			if @isAtEnd()
				options.success?(@)
				return
			options.add = true
			@fetch options

			
