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
			newStatus = {}

			for doc_id, doc of Document.openDocs
				saving = doc.pollSavedStatus()
				if !saving
					if oldStatus[doc_id]?
						newStatus[doc_id] = oldStatus[doc_id]
						newStatus[doc_id].unsavedSeconds += 1
					else
						newStatus[doc_id] = {
							unsavedSeconds: 0
							doc: ide.fileTreeManager.findEntityById(doc_id)
						}

			# for performance, only update the display if the old or new
			# statuses have any unsaved files
			if _.size(newStatus) or _.size(oldStatus)
				$scope.docSavingStatus = newStatus
				$scope.$apply()

		warnAboutUnsavedChanges = () ->
			if Document.hasUnsavedChanges()
				return "You have unsaved changes. If you leave now they will not be saved."
	]
