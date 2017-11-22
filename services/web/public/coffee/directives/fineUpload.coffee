define [
	"base"
	"libs/fineuploader"
], (App, qq) ->
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
				onValidateBatch: "="
				onErrorCallback: "="
				onSubmitCallback: "="
				onCancelCallback: "="
				autoUpload: "="
				params: "="
				control: "="
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
				maxConnections = scope.maxConnections or 1
				onComplete = scope.onCompleteCallback or () ->
				onUpload   = scope.onUploadCallback or () ->
				onError   = scope.onErrorCallback or () ->
				onValidateBatch = scope.onValidateBatch or () ->
				onSubmit = scope.onSubmitCallback or () ->
				onCancel = scope.onCancelCallback or () ->
				if !scope.autoUpload?
					autoUpload = true
				else
					autoUpload = scope.autoUpload
				params     = scope.params or {}
				params._csrf = window.csrfToken
				templateElement = document.createElement('div')
				templateElement.innerHTML = """
				<div class="qq-uploader-selector">
					<div class="qq-upload-drop-area-selector qq-upload-drop-area" qq-hide-dropzone>
						<span class="qq-upload-drop-area-text-selector">Drop files here to upload</span>
					</div>
					<div class="qq-upload-button-selector btn btn-primary btn-lg">
						<div>#{text.uploadButton}</div>
					</div>
					<span class="or btn-lg"> or </span>
					<span class="drag-here btn-lg">#{dragAreaText}</span>
					<span class="qq-drop-processing-selector"><span>#{text.waitingForResponse}</span><span class="qq-drop-processing-spinner-selector"></span></span>
					<div class="small">#{hintText}</div>
					<ul class="qq-upload-list-selector">
						<li>
							<div class="qq-progress-bar-container-selector">
								<div
									role="progressbar"
									aria-valuenow="0"
									aria-valuemin="0"
									aria-valuemax="100"
									class="qq-progress-bar-selector qq-progress-bar">
								</div>
							</div>
							<span class="qq-upload-file-selector qq-upload-file"></span>
							<span class="qq-upload-size-selector qq-upload-size"></span>
							<a type="button" class="qq-btn qq-upload-cancel-selector qq-upload-cancel">Cancel</a>
							<button type="button" class="qq-btn qq-upload-retry-selector qq-upload-retry">Retry</button>
							<span role="status" class="qq-upload-status-text-selector qq-upload-status-text"></span>
						<\li>
					</ul>
				</div>
				"""

				q = new qq.FineUploader
					element: element[0]
					multiple: multiple
					autoUpload: autoUpload
					disabledCancelForFormUploads: true
					validation: validation
					maxConnections: maxConnections
					request:
						endpoint: endpoint
						forceMultipart: true
						params: params
						paramsInBody: false
					callbacks:
						onComplete: onComplete
						onUpload:   onUpload
						onValidateBatch: onValidateBatch
						onError: onError
						onSubmit: onSubmit
						onCancel: onCancel
					text: text
					# template: "qq-uploader"
					template: templateElement
				window.q = q
				scope.control?.q = q
				return q
		}
