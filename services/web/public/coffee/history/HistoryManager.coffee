define [
	"history/VersionListView"
	"history/VersionList"
	"history/HistoryView"
	"account/AccountManager"
	"libs/backbone"
], (VersionListView, VersionList, HistoryView, AccountManager) ->
	HistoryManager = class
		templates:
			historyPanel: $("#historyPanelTemplate").html()
		
		constructor: (ide, options) ->
			@ide = ide
			@ide.on "afterJoinProject", (project) =>
				if !@inited
					@inited = true
					@project = project
					@historyPanel = $(@templates.historyPanel)
					@ide.tabManager.addTab
						id: "history"
						name: "History"
						content: @historyPanel
						after: "code"
						onShown: () => @showHistoryArea()
						lock: true
					@view = new HistoryView
						el : @historyPanel
						manager : this
					@view.render()
					@versionList = new VersionList
					@versionListView = new VersionListView(
						collection : @versionList,
						el         : @view.$("#versionListArea")
					)

		showHistoryArea: ->
			if @project.get("features").versioning
				@view.setHistoryAreaToDisplayHistory()
				@versionList.fetchNewVersions()
				@versionListView.loadUntilFull()
			else
				@view.setHistoryAreaToDisplayEnableVersioning()

		enableVersioning: ->
			AccountManager.askToUpgrade @ide,
				onUpgrade: () =>
					@showHistoryArea()

		takeSnapshot: (message, callback = (error) ->) ->
			$.ajax
				type : "POST"
				url  : "/project/#{@project.id}/snapshot"
				data :
					message: message
					_csrf: csrfToken
				dataType: "json"
				success : (data, status, xhr) =>
					@versionList.fetchNewVersions()
					callback()
				error   : (data, status, xhr) =>
					callback(new Error("takeSnapshot returned with error: #{status}"))

	return HistoryManager
