define [
	"track-changes/models/ChangeList"
	"track-changes/ChangeListView"
], (ChangeList, ChangeListView) ->
	class TrackChangesManager
		template: $("#trackChangesPanelTemplate").html()
		
		constructor: (@ide) ->
			@$el = $(@template)
			$("#editorWrapper").append(@$el)
			@hideEl()

		show: () ->
			project_id = window.userSettings.project_id
			doc_id = @ide.editor.current_doc_id
			@changes = new ChangeList([], doc_id: doc_id, project_id: project_id)

			@changeListView = new ChangeListView(
				collection : @changes,
				el         : @$el.find(".change-list-area")
			)
			@changeListView.render()
			@changeListView.loadUntilFull()

			@showEl()

		showEl: ->
			@ide.editor.hide()
			@$el.show()

		hideEl: () ->
			@ide.editor.show()
			@$el.hide()

	return TrackChangesManager
