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

			PassField.Config.blackList = []
			defaultPasswordOpts =
				pattern: ""
				length:
					min: 1
					max: 50
				allowEmpty: false
				allowAnyChars: false
				isMasked: true
				showToggle: false
				showGenerate: false
				showTip:false
				showWarn:false
				checkMode : PassField.CheckModes.STRICT
				chars:
					digits: "1234567890"
					letters: "abcdefghijklmnopqrstuvwxyz"
					letters_up: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
					symbols: "@#$%^&*()-_=+[]{};:<>/?!£€.,"

			opts = _.defaults(window.passwordStrengthOptions || {}, defaultPasswordOpts)
			if opts.length.min == 1
				opts.acceptRate = 0 #this allows basically anything to be a valid password
			passField = new PassField.Field("passwordField", opts);

			[asyncFormCtrl, ngModelCtrl] = ctrl

			ngModelCtrl.$parsers.unshift (modelValue) ->
				
			
				isValid = passField.validatePass()
				email = asyncFormCtrl.getEmail() || window.usersEmail
				if !isValid
					scope.complexPasswordErrorMessage = passField.getPassValidationMessage()
				else if (email? and email != "")
					startOfEmail = email?.split("@")?[0]
					if modelValue.indexOf(email) != -1 or modelValue.indexOf(startOfEmail) != -1
						isValid = false
						scope.complexPasswordErrorMessage = "Password can not contain email address"
				if opts.length.max? and modelValue.length == opts.length.max
					isValid = false
					scope.complexPasswordErrorMessage = "Maxium password length #{opts.length.max} reached"
				ngModelCtrl.$setValidity('complexPassword', isValid)
				return modelValue
