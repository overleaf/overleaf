define [
	"base"
], (App) ->
	App.factory "logHintsFeedback", ($http, $q) ->
		hintsFeedbackFormAPIHash = "rl4xgvr1v5t64a"
		idStampVal = "OPkEWEFHUFAm7hKlraQMhiOXQabafWo8NipRvLT397w="
		hintFieldAPIId = "3"
		reasonFieldAPIId = "1"
		reasonOtherFieldAPIId = "1_other_other"
		submitEndpoint = "https://sharelatex.wufoo.eu/forms/#{ hintsFeedbackFormAPIHash }/#public"

		feedbackOpts =
			DIDNT_UNDERSTAND: "didnt_understand"
			NOT_APPLICABLE: "not_applicable"
			INCORRECT: "incorrect"
			OTHER: "other"

		createRequest = (hintId, feedbackOpt, feedbackOtherVal = "") ->
			formData = new FormData()

			formData.append "Field#{ hintFieldAPIId }", hintId
			formData.append "Field#{ reasonFieldAPIId }", feedbackOpt
			formData.append "Field#{ reasonOtherFieldAPIId }", feedbackOtherVal
			formData.append "idstamp", idStampVal

			req =
				method: 'POST'
				url: submitEndpoint
				# This will effectively disable Angular's default serialization mechanisms,
				# forcing the XHR to be done with whatever data we provide (in this case,
				# form data). Without this, Angular will forcefully try to serialize data
				# to JSON.
				transformRequest: angular.identity
				data: formData
				headers : 
					# This will tell Angular to use the browser-provided value, which is
					# computed according to the data being sent (in this case, multipart
					# form + browser-specific multipart boundary). Without this, Angular
					# will set JSON.
					"Content-Type": undefined

			return req

		submitFeedback = (hintId, feedbackOpt, feedbackOtherVal = "") ->
			submitRequest = createRequest hintId, feedbackOpt, feedbackOtherVal
			$http(submitRequest)

		service =
			feedbackOpts: feedbackOpts
			submitFeedback: submitFeedback
		
		return service