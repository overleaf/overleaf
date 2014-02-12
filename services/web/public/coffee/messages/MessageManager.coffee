define [
	"utils/Modal"
], (Modal) ->
	class MessageManager
		constructor: (@ide) ->
			if @ide?
				@ide.on "afterJoinProject", (@project) =>
					@checkIfProjectHasBeenDeleted()
					@ide.socket.on "projectRenamedOrDeletedByExternalSource", @notifyUsersProjectHasBeenDeletedOrRenamed

		checkIfProjectHasBeenDeleted: ->
			if @project.get('deletedByExternalDataSource')
				@notifyUsersProjectHasBeenDeletedOrRenamed()

		notifyUsersProjectHasBeenDeletedOrRenamed: ->
				Modal.createModal
					isStatic: false
					title: "Project Renamed or Deleted"
					message: "This project has either been renamed or deleted by an external data source such as Dropbox. We don't want to delete your data on ShareLaTeX, so this project still contains your history and collaborators. If the project has been renamed please look in your project list for a new project under the new name."
					buttons: [{
							text     : "Ok",
							class    : "btn",
						}]
				@ide.mainAreaManager.addArea identifier:"project_deleted", element:$('#projectDeleted')
				@ide.mainAreaManager.change "project_deleted"
