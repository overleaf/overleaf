define [
	"base"
	"libs/passfield"
], (App) ->
	App.directive "asyncForm", ($http) ->
		return {
			controller: ['$scope', ($scope) ->
				@getEmail = () ->
					return $scope.email
				return this
			]
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
							if status == 403 # Forbidden
								response.message =
									text: "Session error. Please check you have cookies enabled. If the problem persists, try clearing your cache and cookies."
									type: "error"
							else
								response.message =
									text: data.message?.text or data.message or "Something went wrong talking to the server :(. Please try again."
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


	App.directive 'complexPassword', ->
		require: ['^asyncForm', 'ngModel']

		link: (scope, element, attrs, ctrl) ->

			passwordStrengthOptions = {
				pattern: "aA$3",
				allowEmpty: false,
				allowAnyChars: false,
				isMasked: true,
				showToggle: false,
				showGenerate: false,
				checkMode:PassField.CheckModes.STRICT,
				length: { min: 8, max: 50 },
				showTip:false,
				showWarn:false
			}

			passwordStrengthOptions.chars = {
				digits: "1234567890",
				letters: "abcdefghijklmnopqrstuvwxyz",
				letters_up: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
				symbols: "@#$%^&*()-_=+[]{};:<>/?!£€"
			}
			
			passField = new PassField.Field("passwordFeild", passwordStrengthOptions);
			console.log "controllers", ctrl, "scope", scope

			[asyncFormCtrl, ngModelCtrl] = ctrl

			# ngModelCtrl.$validators.password = (modelValue, viewValue) ->
			# 	console.log 'model', modelValue, 'view', viewValue, "email", asyncFormCtrl.getEmail()
			# 	complexPasswordErrorMessage = passField.getPassValidationMessage()
			# 	console.log complexPasswordErrorMessage
			# 	isValid = passField.validatePass()
			# 	return isValid

			ngModelCtrl.$parsers.unshift (modelValue, viewValue) ->
				console.log 'model', modelValue, 'view', viewValue, "email", asyncFormCtrl.getEmail()
				complexPasswordErrorMessage = passField.getPassValidationMessage()
				console.log complexPasswordErrorMessage
				isValid = passField.validatePass()
				return isValid


			

			# ctrl.addCheck "email", "password", (email, password) ->
			# 	console.log "email", email, "password", password
			# 	complexPasswordErrorMessage = passField.getPassValidationMessage()
			# 	console.log complexPasswordErrorMessage
			# 	isValid = passField.validatePass()
			# 	return isValid

			# controllers[0].$parsers.unshift (viewValue)->
			# 	console.log scope.parent, scope.password, attrs.email, viewValue	
			# 	scope.complexPasswordErrorMessage = passField.getPassValidationMessage()
			# 	console.log scope.complexPasswordErrorMessage
			# 	isValid = passField.validatePass()
			# 	controllers.$setValidity('complexPassword', isValid)
			# 	return viewValue

				
