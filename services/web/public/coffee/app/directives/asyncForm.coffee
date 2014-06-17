define [
	"base"
], (App) ->
	App.directive "asyncForm", ($http) ->
		return {
			link: (scope, element, attrs) ->
				formName = attrs.asyncForm

				element.on "submit", (e) ->
					e.preventDefault()

					formData = {}
					for data in element.serializeArray()
						formData[data.name] = data.value

					$http
						.post(element.attr('action'), formData)
						.success (data, status, headers, config) ->
							scope.success = true
							scope.error = false

							if data.redir?
								ga('send', 'event', formName, 'success')
								window.location = data.redir
							else if data.message?
								scope.message = data.message

								if data.message.type == "error"
									scope.success = false
									scope.error = true
									ga('send', 'event', formName, 'failure', data.message)
								else
									ga('send', 'event', formName, 'success')
									
						.error (data, status, headers, config) ->
							scope.success = false
							scope.error = true
							ga('send', 'event', formName, 'failure', data.message)
							scope.message =
								text: data.message or "Something went wrong talking to the server :(. Please try again."
								type: 'error'
		}

	App.directive "formMessages", () ->
		return {
			restrict: "E"
			template: """
				<div class="alert" ng-class="{
					'alert-danger': message.type == 'error',
					'alert-success': message.type != 'error'
				}" ng-show="!!message">
					{{message.text}}
				</div>
				<div ng-transclude></div>
			"""
			transclude: true
		}