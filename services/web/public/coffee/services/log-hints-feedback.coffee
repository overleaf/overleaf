define [
	"base"
], (App) ->
	App.factory "logHintsFeedback", ($http, $q) ->
		if window.sharelatex?.wufoo? and window.sharelatex.wufoo?.token? and window.sharelatex.wufoo?.url?
			hintsFeedbackFormAPIHash = "rl4xgvr1v5t64a"
			hintFieldAPIId = '3'
			feedbackFieldAPIId = '1'
			basicAuthVal = window.btoa "#{ window.sharelatex.wufoo.token }:anypasswilldo"
			submitEndpoint = "#{ window.sharelatex.wufoo.url }/api/v3/forms/#{ hintsFeedbackFormAPIHash }/entries.json" 

		feedbackOpts =
			DIDNT_UNDERSTAND: "didnt_understand"
			NOT_APPLICABLE: "not_applicable"
			INCORRECT: "incorrect"
			OTHER: "other"

		createRequest = (hintId, feedbackOpt, feedbackOtherVal = "") ->
			req =
				method: 'POST'
				url: submitEndpoint
				headers: 
					Authorization: "Basic #{ basicAuthVal }"

			req.data = {}
			req.data["Field#{ hintFieldAPIId }"] = hintId
			req.data["Field#{ hintFieldAPIId }"] = feedbackOpt

			if feedbackOpt == feedbackOpts.OTHER and feedbackOtherVal != ""
				req.data["Field#{ hintFieldAPIId }"] = feedbackOtherVal

			return req

		submitFeedback = (hintId, feedbackOpt, feedbackOtherVal = "") ->
			submitRequest = createRequest hintId, feedbackOpt, feedbackOtherVal

			submitFeedback.then (response) ->
				console.log response

		service =
			feedbackOpts: feedbackOpts
			submitFeedback: submitFeedback
		
		return service