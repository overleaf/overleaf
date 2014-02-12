define [
	"models/FolderChildren"
	"models/File"
	"models/Doc"
	"libs/backbone"
], (FolderChildren, File, Doc) ->
	Folder = Backbone.Model.extend
		initialize: () ->
			if !@get("children")?
				@set("children", new FolderChildren())

			@get("children").parentFolder = @
			@on "change:children", () =>
				@get("children").parentFolder = @

			@set("type", "folder")

		parse: (rawAttributes) ->
			attributes =
				id: rawAttributes._id
				name: rawAttributes.name
			children = []
			for childFolder in rawAttributes.folders
				children.push new Folder(childFolder, parse: true)
			for file in rawAttributes.fileRefs
				children.push new File(file, parse: true)
			for doc in rawAttributes.docs
				children.push new Doc(doc, parse: true)
			attributes.children = new FolderChildren(children)
			return attributes

		getParentFolderIds: () ->
			ids = @collection?.parentFolder?.getParentFolderIds() or []
			ids.push @id
			return ids
			
