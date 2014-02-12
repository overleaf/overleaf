define [
	"libs/mustache"
	"libs/backbone"
], ()->

	FileDiffView = Backbone.View.extend
		className: "fileDiffView"
	
		template: $("#fileDiffTemplate").html()

		events:
			"click .nav .raw" : "loadRawFile"

		render: ->
			$(@el).html Mustache.to_html(@template, @modelView())
			return this

		modelView: ->
			fileView     = @model.toJSON()
			fileView.id  = @model.cid
			fileView.url = @model.url()
			fileView.headerClass = "updated"
			fileView.deleted = false

			if fileView.sections? and fileView.sections.length > 0
				fileView.diff = true
				for section in fileView.sections
					currentOldLine = section.old_start_line
					currentNewLine = section.new_start_line
					for line in section.lines
						line.old_number = currentOldLine
						line.new_number = currentNewLine
						if line.type == "added"
							currentNewLine += 1
							line.added = true
						if line.type == "removed"
							currentOldLine += 1
							line.removed = true
						if line.type == "unchanged"
							currentNewLine += 1
							currentOldLine += 1
							line.unchanged = true

			if fileView.type == "renamed"
				fileView.moved   = true
				fileView.newPath = fileView.path
				fileView.path    = fileView.oldPath

			if fileView.type == "created"
				fileView.headerClass = "created"

			if fileView.type == "deleted"
				fileView.headerClass = "deleted"
				fileView.deleted = true

			return fileView

		loadRawFile: ->
			unless @loadedRawFile
				view = this
				@model.fetch
					success: (model) ->
						view.$(".rawFileContent").text(model.get("content"))
				@loadedRawFile = true
