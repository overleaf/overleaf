EditorUpdatesController = require("../Features/Editor/EditorUpdatesController")
EditorRealTimeController = require("../Features/Editor/EditorRealTimeController")

module.exports = BackgroundTasks =
	run: () ->
		EditorUpdatesController.listenForUpdatesFromDocumentUpdater()
		EditorRealTimeController.listenForEditorEvents()
