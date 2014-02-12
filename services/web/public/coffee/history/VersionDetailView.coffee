define [
	"./util"
	"history/FileDiff"
	"history/FileDiffView"
	"libs/mustache"
	"libs/backbone"
], (util, FileDiff, FileDiffView)->
	VersionView = Backbone.View.extend
		template : $("#diffTemplate").html()

		render: ->
			html = Mustache.to_html(@template, @modelView())
			@$el = $("#diffViewArea")

			@$el.empty()
			@$el.append html

			for fileDiff in @model.get("file_diffs")
				model = new FileDiff(_.extend(fileDiff, version_id: @model.get("id")))
				view = new FileDiffView model: model
				@$el.append view.render().el

			return this

		modelView: ->
			modelView = @model.toJSON()
			modelView.date = util.formatDate(modelView.date)
			return modelView
