define [
	"base"
	"ide/editor/Document"
], (App, Document) ->
	App.controller "SavingNotificationController", ["$scope", "$interval", "ide", ($scope, $interval, ide) ->
		setInterval () ->
			pollSavedStatus()
		, 1000

		$(window).bind 'beforeunload', () =>
			warnAboutUnsavedChanges()

		$scope.docSavingStatus = {}
		pollSavedStatus = () ->
			oldStatus = $scope.docSavingStatus
			oldUnsavedCount = $scope.docSavingStatusCount
			newStatus = {}
			newUnsavedCount = 0

			for doc_id, doc of Document.openDocs
				saving = doc.pollSavedStatus()
				if !saving
					newUnsavedCount++
					if oldStatus[doc_id]?
						newStatus[doc_id] = oldStatus[doc_id]
						newStatus[doc_id].unsavedSeconds += 1
					else
						newStatus[doc_id] = {
							unsavedSeconds: 0
							doc: ide.fileTreeManager.findEntityById(doc_id)
						}

			# for performance, only update the display if the old or new
			# counts of unsaved files are nonzeror.  If both old and new
			# unsaved counts are zero then we know we are in a good state
			# and don't need to do anything to the UI.
			if newUnsavedCount or oldUnsavedCount
				$scope.docSavingStatus = newStatus
				$scope.docSavingStatusCount = newUnsavedCount
				$scope.$apply()

		warnAboutUnsavedChanges = () ->
			if Document.hasUnsavedChanges()
				return "You have unsaved changes. If you leave now they will not be saved."
	]
