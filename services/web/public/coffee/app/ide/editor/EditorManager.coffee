define [
	"ide/editor/Document"
	"ide/editor/directives/aceEditor"
], (Document) ->
	class EditorManager
		constructor: (@ide, @$scope) ->
			@$scope.editor = {
				sharejs_doc: null
			}

		openDoc: (doc, options = {}) ->
			# TODO: Don't open if already open
			@_openNewDocument doc, (error, sharejs_doc) =>
				if error?
					@ide.showGenericServerErrorMessage()
					return

				@$scope.$apply () =>
					@$scope.editor.sharejs_doc = sharejs_doc

		_openNewDocument: (doc, callback = (error, sharejs_doc) ->) ->
			current_sharejs_doc = @$scope.editor.sharejs_doc
			if current_sharejs_doc?
				current_sharejs_doc.leaveAndCleanUp()
				@_unbindFromDocumentEvents(current_sharejs_doc)

			new_sharejs_doc = Document.getDocument @ide, doc.id

			new_sharejs_doc.join (error) =>
				return callback(error) if error?
				@_bindToDocumentEvents(new_sharejs_doc)
				callback null, new_sharejs_doc

		_bindToDocumentEvents: (document) ->

			document.on "error", (error) =>
				@openDoc(document.doc_id, forceReopen: true)

				Modal.createModal
					title: "Out of sync"
					message: "Sorry, this file has gone out of sync and we need to do a full refresh. Please let us know if this happens frequently."
					buttons:[
						text: "Ok"
					]

			document.on "externalUpdate", () =>
				Modal.createModal
					title: "Document Updated Externally"
					message: "This document was just updated externally. Any recent changes you have made may have been overwritten. To see previous versions please look in the history."
					buttons:[
						text: "Ok"
					]

		_unbindFromDocumentEvents: (document) ->
			document.off()
