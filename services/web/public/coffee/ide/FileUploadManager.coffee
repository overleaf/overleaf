define [
	"utils/Modal"
	"libs/fineuploader"
], (Modal) ->
	class FileUploadManager
		constructor: (@ide) ->
			@ide.on "afterJoinProject", () =>
				if @ide.isAllowedToDoIt "readAndWrite"
					$('button#upload-file').click (e)=>
						@showUploadDialog()

		showUploadDialog: (folder_id, callback = (error, entity_ids) ->) ->
			uploaderEl = $("<div/>")
			modal = new Modal
				title: "Upload file"
				el: uploaderEl
				buttons: [{
					text: "Close"
				}]

			uploadCount = 0
			entity_ids = []
			new qq.FineUploader
				element: uploaderEl[0]
				disabledCancelForFormUploads: true
				maxConnections: 1
				request:
					endpoint: "/Project/#{@ide.project.id}/upload"
					params:
						folder_id: folder_id
						_csrf: csrfToken
					paramsInBody: false
					forceMultipart: true
				callbacks:
					onUpload: () -> uploadCount++
					onComplete: (error, name, response) ->
						setTimeout (() ->
							uploadCount--
							entity_ids.push response.entity_id
							if uploadCount == 0 and response? and response.success
								modal.remove()
								callback null, entity_ids
						), 250
				text:
					waitingForResponse: "Inserting file..."
					failUpload: "Upload failed, sorry :("
					uploadButton: "Select file(s)"
				template: """
					<div class="qq-uploader">
						<div class="qq-upload-drop-area"><span>{dragZoneText}</span></div>
						<div class="qq-upload-button btn btn-primary btn-large">
							<div>{uploadButtonText}</div>
						</div>
						<span class="or btn-large"> or </span>
						<span class="drag-here btn-large">drag file(s)</span>
						<span class="qq-drop-processing"><span>{dropProcessingText}</span><span class="qq-drop-processing-spinner"></span></span>
						<div class="help">Hint: Press and hold the Control (Ctrl) key to select multiple files</div>
						<ul class="qq-upload-list"></ul>
					</div>
				"""
			$(".qq-uploader input").addClass("js-file-uploader")


