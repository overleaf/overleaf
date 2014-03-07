define [
	"track-changes/models/Change"
	"libs/backbone"
], (Change)->
	ChangeList = Backbone.Collection.extend
		model: Change
		batchSize: 3

		initialize: (models, @options) ->

		url: () ->
			url = "/project/#{@options.project_id}/doc/#{@options.doc_id}/updates?limit=#{@batchSize}"
			if @models.length > 0
				last = @models[@models.length - 1]
				url += "&to=#{last.get("version") - 1}"
			return url

		parse: (json) ->
			return json.updates

		fetchNextBatch: (options = {}) ->
			options.add = true
			@fetch options

			
