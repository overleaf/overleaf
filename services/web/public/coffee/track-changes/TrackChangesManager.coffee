define [
	"track-changes/models/ChangeList"
	"track-changes/models/Diff"
	"track-changes/ChangeListView"
	"track-changes/DiffView"
	"utils/Modal"
	"models/Doc"
	"moment"
], (ChangeList, Diff, ChangeListView, DiffView, Modal, Doc, moment) ->
	class TrackChangesManager
		template: $("#trackChangesPanelTemplate").html()
		
		constructor: (@ide) ->
			@project_id = window.userSettings.project_id
			@$el = $(@template)
			$("#editorWrapper").append(@$el)
			@hideEl()

			@ide.editor.on "change:doc", () =>
				@hideEl()

			@ide.editor.on "resize", () =>
				@diffView?.resize()

			@$el.find(".track-changes-close").on "click", (e) =>
				e.preventDefault
				@hide()

			@ide.fileTreeManager.on "contextmenu:beforeshow", (entity, entries) =>
				if entity instanceof Doc
					entries.push {
						divider: true
					}, {
						text: "History"
						onClick: () =>
							@show(entity.id)
					}

		show: (@doc_id) ->
			@ide.fileTreeManager.selectEntity(@doc_id)

			@changes = new ChangeList([], project_id: @project_id, ide: @ide)

			@changeListView = new ChangeListView(
				collection : @changes,
				el         : @$el.find(".change-list-area")
			)
			@changeListView.render()
			@changeListView.loadUntilFull (error) =>
				@autoSelectDiff()

			@changeListView.on "change_diff", (fromModel, toModel) =>
				@showDiff(fromModel, toModel)

			@changeListView.on "restore", (change) =>
				@restore(change)

			if @diffView?
				@diffView.destroy()

			@showEl()

		hide: () ->
			@hideEl()
			@ide.fileTreeManager.openDoc(@doc_id)

		autoSelectDiff: () ->
			if @changes.models.length == 0
				return

			# Find all change until the last one we made
			fromIndex = null
			for change, i in @changes.models
				if ide.user in change.get("users")
					if i > 0
						fromIndex = i - 1
					else
						fromIndex = 0
					break
			fromIndex = 0 if !fromIndex

			toChange = @changes.models[0]
			fromChange = @changes.models[fromIndex]
			@showDiff(fromChange, toChange)
			@changeListView.setSelectionRange(fromIndex, 0)

		showDiff: (fromModel, toModel) ->
			@diff = new Diff({
				project_id: @project_id
				doc_id: @doc_id
				from: fromModel.get("fromVersion")
				to:   toModel.get("toVersion")
			})

			if @diffView?
				@diffView.destroy()
			@diffView = new DiffView(
				model: @diff
				el:    @$el.find(".track-changes-diff")
			)
			@diff.fetch()

		showEl: ->
			@ide.editor.hide()
			@$el.show()

		hideEl: () ->
			@ide.editor.show()
			@$el.hide()

		restore: (change) ->
			name = @ide.fileTreeManager.getNameOfEntityId(@doc_id)
			date = moment(change.get("start_ts")).format("Do MMM YYYY, h:mm:ss a")
			modal = new Modal({
				title: "Restore document"
				message: "Are you sure you want to restore <strong>#{name}</strong> to before the changes on #{date}?"
				buttons: [{
					text: "Cancel"
				}, {
					text: "Restore"
					class: "btn-success"
					close: false
					callback: ($button) =>
						$button.text("Restoring...")
						$button.prop("disabled", true)
						@doRestore change.get("version"), (error) =>
							modal.remove()
							@hide()
				}]
			})

		doRestore: (version, callback = (error) ->) ->
			$.ajax {
				url: "/project/#{@project_id}/doc/#{@doc_id}/version/#{version}/restore"
				type: "POST"
				headers:
					"X-CSRF-Token": window.csrfToken
				success: () ->
					callback()
				error: (error) ->
					callback(error)
			}

	return TrackChangesManager
