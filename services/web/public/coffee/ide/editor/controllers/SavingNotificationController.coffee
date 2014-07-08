define [
	"base"
	"ide/editor/Document"
], (App, Document) ->
	App.controller "SavingNotificationController", ["$scope", "$interval", "ide", ($scope, $interval, ide) ->
		$interval () ->
			pollSavedStatus()
		, 1000

		$(window).bind 'beforeunload', () =>
			warnAboutUnsavedChanges()

		$scope.docSavingStatus = {}
		pollSavedStatus = () ->
			oldStatus = $scope.docSavingStatus
			$scope.docSavingStatus = {}

			for doc_id, doc of Document.openDocs
				saving = doc.pollSavedStatus()
				if !saving
					if oldStatus[doc_id]?
						$scope.docSavingStatus[doc_id] = oldStatus[doc_id]
						$scope.docSavingStatus[doc_id].unsavedSeconds += 1
					else
						$scope.docSavingStatus[doc_id] = {
							unsavedSeconds: 0
							doc: ide.fileTreeManager.findEntityById(doc_id)
						}

		warnAboutUnsavedChanges = () ->
			if Document.hasUnsavedChanges()
				return "You have unsaved changes. If you leave now they will not be saved."
	]