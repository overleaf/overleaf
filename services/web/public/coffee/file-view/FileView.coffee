define [
	"libs/bootstrap"
	"libs/mustache"
	"libs/backbone"
], () ->
	FileViewManager = Backbone.View.extend
		template: $("#fileViewTemplate").html()
		className: "fullEditorArea"
		id: "fileViewArea"
		
		render: () ->
			extension = @model.get("name").split(".").pop().toLowerCase()
			image = (["jpg", "jpeg", "png", "gif", "eps", "pdf"].indexOf(extension) != -1)
			html = Mustache.to_html(@template, {
				name: @model.get("name")
				downloadUrl: @model.downloadUrl()
				previewUrl: @model.previewUrl()
				image: image
			})
			@$el.html(html)

		setModel: (model) ->
			@model = model
			@render()
			@onResize()

		onResize: () ->
			@$("img").css
				"max-width": ($("#fileViewArea").width() - 40) + "px"
				"max-height": ($("#fileViewArea").height() - 140) + "px"
