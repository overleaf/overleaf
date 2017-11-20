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
				console.log ">> element", element
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
					template: document.getElementById('qq-uploader')
				window.q = q
				scope.control?.q = q
				return q
		}
