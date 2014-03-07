define [
	"track-changes/models/ChangeList"
	"track-changes/models/Diff"
	"track-changes/ChangeListView"
	"track-changes/DiffView"
], (ChangeList, Diff, ChangeListView, DiffView) ->
	class TrackChangesManager
		template: $("#trackChangesPanelTemplate").html()
		
		constructor: (@ide) ->
			@$el = $(@template)
			$("#editorWrapper").append(@$el)
			@hideEl()

			@ide.editor.on "change:doc", () =>
				@hideEl()

			@$el.find(".track-changes-close").on "click", (e) =>
				e.preventDefault
				@hideEl()

		show: () ->
			@project_id = window.userSettings.project_id
			@doc_id = @ide.editor.current_doc_id
			@changes = new ChangeList([], doc_id: @doc_id, project_id: @project_id)

			@changeListView = new ChangeListView(
				collection : @changes,
				el         : @$el.find(".change-list-area")
			)
			@changeListView.render()
			@changeListView.loadUntilFull()

			@changeListView.on "change_diff", (fromModel, toModel) =>
				@diff = new Diff({
					project_id: @project_id
					doc_id: @doc_id
					from: fromModel.get("version")
					to:   toModel.get("version")
				})
				@diffView = new DiffView(
					model: @diff
					el:    @$el.find(".track-changes-diff")
				)
				@diff.fetch()

			@showEl()

		showEl: ->
			@ide.editor.hide()
			@$el.show()

		hideEl: () ->
			@ide.editor.show()
			@$el.hide()

	return TrackChangesManager
