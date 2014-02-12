define [
	"history/Version"
	"libs/backbone"
], (Version)->
	VersionList = Backbone.Collection.extend
		model: Version
		batchSize: 50

		url: () ->
			url = "/project/#{window.userSettings.project_id}/version?limit=#{@batchSize}"
			if @models.length > 0
				last = @models[@models.length - 1]
				url += "&before=#{last.get("id")}"
			return url

		parse: (json) ->
			for version in json.versions
				version.date = new Date(version.date)
			return json.versions

		comparator: (version) -> - Date.parse(version.get("date"))

		fetchNextBatch: (options = {}) ->
			options.add = true
			@fetch options

		fetchNewVersions: (options = {}) ->
			options.url = "/project/#{window.userSettings.project_id}/version?limit=5"
			options.add = true
			unless options.timeout?
				options.timeout = 10000 #milliseconds

			# Keep requesting the beginning of the version list
			# until we've added some more versions or reached the 
			# timeout limit.
			currentVersionCount = @models.length
			continueLoading = () =>
				unless @models.length > currentVersionCount
					unless options.timeout <= 0
						runAgain = () =>
							options.timeout = options.timeout - 1000
							@fetchNewVersions(options)
						setTimeout(runAgain, 1000)
			options.success = continueLoading
			options.error = continueLoading
			@fetch options

			
