define [
	"base"
], (App) ->
	App.directive "asyncForm", ($http) ->
		return {
			link: (scope, element, attrs) ->
				formName = attrs.asyncForm

				scope[attrs.name].response = response = {}
				scope[attrs.name].inflight = false

				element.on "submit", (e) ->
					e.preventDefault()

					formData = {}
					for data in element.serializeArray()
						formData[data.name] = data.value

					scope[attrs.name].inflight = true

					$http
						.post(element.attr('action'), formData)
						.success (data, status, headers, config) ->
							scope[attrs.name].inflight = false
							response.success = true
							response.error = false

							if data.redir?
								ga('send', 'event', formName, 'success')
								window.location = data.redir
							else if data.message?
								response.message = data.message

								if data.message.type == "error"
									response.success = false
									response.error = true
									ga('send', 'event', formName, 'failure', data.message)
								else
									ga('send', 'event', formName, 'success')

						.error (data, status, headers, config) ->
							scope[attrs.name].inflight = false
							response.success = false
							response.error = true
							response.message =
								text: data.message?.text or "Something went wrong talking to the server :(. Please try again."
								type: 'error'
							ga('send', 'event', formName, 'failure', data.message)
		}

	App.directive "formMessages", () ->
		return {
			restrict: "E"
			template: """
				<div class="alert" ng-class="{
					'alert-danger': form.response.message.type == 'error',
					'alert-success': form.response.message.type != 'error'
				}" ng-show="!!form.response.message">
					{{form.response.message.text}}
				</div>
				<div ng-transclude></div>
			"""
			transclude: true
			scope: {
				form: "=for"
			}

		}
