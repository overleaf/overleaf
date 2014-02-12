define [
	"models/Folder"
	"libs/backbone"
], (Folder) ->
	FolderChildren = Backbone.Collection.extend
		comparator: (a,b) ->
			# Group folders at the top and then sort by name
			Folder = require("models/Folder") # recursive includes

			aName = a.get("name")
			if a instanceof Folder
				aName = "0" + aName
			else
				aName = "1" + aName

			bName = b.get("name")
			if b instanceof Folder
				bName = "0" + bName
			else
				bName = "1" + bName

			if aName < bName
				return -1
			else if aName > bName
				return 1
			else
				return 0


