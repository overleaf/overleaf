define [
	"base"
	"../../libs/fineuploader"
], (App) ->
	App.directive 'fineUpload', ($timeout) ->
		return {
			scope: {
				multiple: "="
				endpoint: "@"
				waitingForResponseText: "@"
				failedUploadText: "@"
				uploadButtonText: "@"
				dragAreaText: "@"
				hintText: "@"
				allowedExtensions: "="
				onCompleteCallback: "="
				onUploadCallback: "="
				params: "="
			}
			link: (scope, element, attrs) ->
				multiple = scope.multiple or false
				endpoint = scope.endpoint
				if scope.allowedExtensions?
					validation = 
						allowedExtensions: scope.allowedExtensions
				else
					validation = {}
				text =
					waitingForResponse: scope.waitingForResponseText or "Processing..."
					failUpload: scope.failedUploadText or "Failed :("
					uploadButton: scope.uploadButtonText or "Upload"
				dragAreaText = scope.dragAreaText or "drag here"
				hintText = scope.hintText or ""

				onComplete = scope.onCompleteCallback or () ->
				onUpload   = scope.onUploadCallback or () ->
				params     = scope.params or {}
				params._csrf = window.csrfToken

				console.log "PARAMS", params

				new qq.FineUploader
					element: element[0]
					multiple: multiple
					disabledCancelForFormUploads: true
					validation: validation
					request:
						endpoint: endpoint
						forceMultipart: true
						params: params
						paramsInBody: false
					callbacks:
						onComplete: onComplete
						onUpload:   onUpload
					text: text
					template: """
						<div class="qq-uploader">
							<div class="qq-upload-drop-area"><span>{dragZoneText}</span></div>
							<div class="qq-upload-button btn btn-primary btn-lg">
								<div>{uploadButtonText}</div>
							</div>
							<span class="or btn-lg"> or </span>
							<span class="drag-here btn-lg">#{dragAreaText}</span>
							<span class="qq-drop-processing"><span>{dropProcessingText}</span><span class="qq-drop-processing-spinner"></span></span>
							<div class="small">#{hintText}</div>
							<ul class="qq-upload-list"></ul>
						</div>
					"""
		}