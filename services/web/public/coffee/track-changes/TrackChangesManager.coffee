define [
	"track-changes/models/ChangeList"
	"track-changes/models/Diff"
	"track-changes/ChangeListView"
	"track-changes/DiffView"
	"account/AccountManager"
	"utils/Modal"
	"models/Doc"
	"moment"
], (ChangeList, Diff, ChangeListView, DiffView, AccountManager, Modal, Doc, moment) ->
	class TrackChangesManager
		template: $("#trackChangesPanelTemplate").html()
		
		constructor: (@ide) ->
			@project_id = window.userSettings.project_id
			@$el = $(@template)
			@ide.mainAreaManager.addArea
				identifier: "trackChanges"
				element: @$el

			@ide.tabManager.addTab
				id: "history"
				name: "History"
				show: "code"
				after: "code"
				contract: true
				onShown: () => @show()
				onHidden: () => @hide()

			@ide.editor.on "resize", () =>
				@diffView?.resize()

			@$el.find(".track-changes-close").on "click", (e) =>
				e.preventDefault
				@hide()

			@bindToFileTreeEvents()

			@disable()

		bindToFileTreeEvents: () ->
			@ide.fileTreeManager.on "open:doc", (doc_id) =>
				@doc_id = doc_id
				if @enabled
					@updateDiff()

		AB_BUCKETS: ["control", "one-week", "pop-up"]
		show: () ->
			@changes = new ChangeList([], project_id: @project_id, ide: @ide)

			if @changeListView?
				@changeListView.remove()
			@changeListView = new ChangeListView(
				el: @$el.find(".change-list-area")
				collection: @changes
			)
			@changeListView.render()
			@changeListView.loadUntilFull (error) =>
				@autoSelectDiff()

			@changeListView.on "change_diff", (fromIndex, toIndex) =>
				@findDocsInChange(fromIndex, toIndex)
				@updateLabels()
				@updateDiff()

			@showUpgradeView()

			if @diffView?
				@diffView.remove()

			@ide.mainAreaManager.change "trackChanges"
			@ide.editor.disable()
			@ide.fileViewManager.disable()

			@ide.fileTreeManager.makeReadOnly()
			@ide.fileTreeManager.showDeletedDocs()

			@enable()

		showUpgradeView: () ->
			@$el.find("button.start-free-trial").off "click.track-changes"
			@$el.find("button.start-free-trial").on "click.track-changes", () => @gotoFreeTrial()

			if !@ide.project.get("features").versioning
				ga('send', 'event', 'subscription-funnel', 'askToUgrade', "trackchanges")
				@$el.find(".track-changes-upgrade-popup").show()

				if @ide.project.get("owner") == @ide.user
					@$el.find(".show-when-not-owner").hide()
				else
					@$el.find(".show-when-owner").hide()

		hide: () ->
			@ide.editor.enable()
			@ide.fileViewManager.enable()
			@disable()

			doc = @ide.fileTreeManager.getEntity(@doc_id, include_deleted: true)
			if doc? and doc.get("deleted")
				@ide.fileTreeManager.openDoc(@ide.project.get("rootDoc_id"))
			else
				@ide.fileTreeManager.openDoc(@doc_id)

			@ide.tabManager.show "code"
			@resetLabels()
			@ide.fileTreeManager.makeReadWriteIfAllowed()
			@ide.fileTreeManager.hideDeletedDocs()

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
			@changeListView.setSelectionRange(fromIndex, 0)
			@updateDiff()

		findDocsInChange: (fromIndex, toIndex) ->
			@changed_doc_ids = []
			for change in @changes.models.slice(toIndex, fromIndex + 1)
				for doc in change.get("docs") or []
					@changed_doc_ids.push doc.id if doc.id not in @changed_doc_ids

			if !@doc_id? or @doc_id not in @changed_doc_ids
				@doc_id = @changed_doc_ids[0]

			@updateDiff()

		updateLabels: () ->
			labels = {}
			for doc_id in @changed_doc_ids
				labels[doc_id] = true
			@ide.fileTreeManager.setLabels(labels)

		resetLabels: () ->
			@ide.fileTreeManager.setLabels({})


		updateDiff: () ->
			fromIndex = @changeListView.selectedFromIndex
			toIndex   = @changeListView.selectedToIndex

			if !toIndex? or !fromIndex?
				console.log "No selection - what should we do!?"
				return

			{from, to, start_ts, end_ts} = @_findDocVersionsRangeInSelection(@doc_id, fromIndex, toIndex)

			@diff = new Diff({
				project_id: @project_id
				doc_id: @doc_id
				from: from
				to: to
				start_ts: start_ts
				end_ts: end_ts
			}, {
				ide: @ide
			})

			if @diffView?
				@diffView.remove()

			if !@diff.get("doc")?
				console.log "This document does not exist. What should we do?"
				return

			@diffView = new DiffView(
				model: @diff
				el:    @$el.find(".track-changes-diff")
			)

			@diffView.on "restore", () =>
				@restoreDiff(@diff)

			@diffView.on "restore-deleted", () =>
				@restoreDeletedDoc @diff.get("doc"), (error, doc_id) =>
					return if error? or !doc_id?
					setTimeout () =>
						# Give doc a chance to appear in file tree via socket.io
						@hide()
						@ide.fileTreeManager.openDoc(doc_id)
					, 1000

			@ide.fileTreeManager.selectEntity(@doc_id)


		_findDocVersionsRangeInSelection: (doc_id, fromIndex, toIndex) ->
			from = to = start_ts = end_ts = null

			for change in @changes.models.slice(toIndex, fromIndex + 1)
				for doc in change.get("docs")
					if doc.id == doc_id
						if from? and to?
							from = Math.min(from, doc.fromV)
							to = Math.max(to, doc.toV)
							start_ts = Math.min(start_ts, change.get("start_ts"))
							end_ts = Math.max(end_ts, change.get("end_ts"))
						else
							from = doc.fromV
							to = doc.toV
							start_ts = change.get("start_ts")
							end_ts = change.get("end_ts")
						break

			return {from, to, start_ts, end_ts}

		restoreDiff: (diff) ->
			name = diff.get("doc")?.get("name")
			date = moment(diff.get("start_ts")).format("Do MMM YYYY, h:mm:ss a")
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
						diff.restore (error) =>
							modal.remove()
							@hide()
				}]
			})

		restoreDeletedDoc: (doc, callback) ->
			$.ajax {
				url: "/project/#{@project_id}/doc/#{doc.get("id")}/restore"
				type: "POST"
				dataType: "json"
				data:
					name: doc.get("name")
				headers:
					"X-CSRF-Token": window.csrfToken
				success: (body, status, response) ->
					callback(null, body?.doc_id)
				error: (error) ->
					callback(error)
			}

		enable: () ->
			@enabled = true

		disable: () ->
			@enabled = false

		gotoFreeTrial: () ->
			AccountManager.gotoSubscriptionsPage()
			ga('send', 'event', 'subscription-funnel', 'upgraded-free-trial', "trackchanges")

	return TrackChangesManager
