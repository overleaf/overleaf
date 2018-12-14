/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base', 'libs/passfield'], function(App) {
  App.directive('asyncForm', ($http, validateCaptcha) => ({
    controller: [
      '$scope',
      function($scope) {
        this.getEmail = () => $scope.email
        return this
      }
    ],
    link(scope, element, attrs) {
      let response
      const formName = attrs.asyncForm

      scope[attrs.name].response = response = {}
      scope[attrs.name].inflight = false

      const validateCaptchaIfEnabled = function(callback) {
        if (callback == null) {
          callback = function(response) {}
        }
        if (attrs.captcha != null) {
          return validateCaptcha(callback)
        } else {
          return callback()
        }
      }

      const submitRequest = function(grecaptchaResponse) {
        const formData = {}
        for (var data of Array.from(element.serializeArray())) {
          formData[data.name] = data.value
        }

        if (grecaptchaResponse != null) {
          formData['g-recaptcha-response'] = grecaptchaResponse
        }

        scope[attrs.name].inflight = true

        // for asyncForm prevent automatic redirect to /login if
        // authentication fails, we will handle it ourselves
        return $http
          .post(element.attr('action'), formData, {
            disableAutoLoginRedirect: true
          })
          .then(function(httpResponse) {
            let config, headers, status
            ;({ data, status, headers, config } = httpResponse)
            scope[attrs.name].inflight = false
            response.success = true
            response.error = false

            const onSuccessHandler = scope[attrs.onSuccess]
            if (onSuccessHandler) {
              onSuccessHandler(httpResponse)
              return
            }

            if (data.redir != null) {
              ga('send', 'event', formName, 'success')
              return (window.location = data.redir)
            } else if (data.message != null) {
              response.message = data.message

              if (data.message.type === 'error') {
                response.success = false
                response.error = true
                return ga('send', 'event', formName, 'failure', data.message)
              } else {
                return ga('send', 'event', formName, 'success')
              }
            }
          })
          .catch(function(httpResponse) {
            let config, headers, status
            ;({ data, status, headers, config } = httpResponse)
            scope[attrs.name].inflight = false
            response.success = false
            response.error = true
            response.status = status
            response.data = data

            const onErrorHandler = scope[attrs.onError]
            if (onErrorHandler) {
              onErrorHandler(httpResponse)
              return
            }

            if (status === 400) {
              // Bad Request
              response.message = {
                text: 'Invalid Request. Please correct the data and try again.',
                type: 'error'
              }
            } else if (status === 403) {
              // Forbidden
              response.message = {
                text:
                  'Session error. Please check you have cookies enabled. If the problem persists, try clearing your cache and cookies.',
                type: 'error'
              }
            } else {
              response.message = {
                text:
                  (data.message != null ? data.message.text : undefined) ||
                  data.message ||
                  'Something went wrong talking to the server :(. Please try again.',
                type: 'error'
              }
            }
            return ga('send', 'event', formName, 'failure', data.message)
          })
      }

      const submit = () =>
        validateCaptchaIfEnabled(response => submitRequest(response))

      element.on('submit', function(e) {
        e.preventDefault()
        return submit()
      })

      if (attrs.autoSubmit) {
        return submit()
      }
    }
  }))

  App.directive('formMessages', () => ({
    restrict: 'E',
    template: `\
<div class="alert" ng-class="{
	'alert-danger': form.response.message.type == 'error',
	'alert-success': form.response.message.type != 'error'
}" ng-show="!!form.response.message" ng-bind-html="form.response.message.text">
</div>
<div ng-transclude></div>\
`,
    transclude: true,
    scope: {
      form: '=for'
    }
  }))

  return App.directive('complexPassword', () => ({
    require: ['^asyncForm', 'ngModel'],

    link(scope, element, attrs, ctrl) {
      PassField.Config.blackList = []
      const defaultPasswordOpts = {
        pattern: '',
        length: {
          min: 6,
          max: 128
        },
        allowEmpty: false,
        allowAnyChars: false,
        isMasked: true,
        showToggle: false,
        showGenerate: false,
        showTip: false,
        showWarn: false,
        checkMode: PassField.CheckModes.STRICT,
        chars: {
          digits: '1234567890',
          letters: 'abcdefghijklmnopqrstuvwxyz',
          letters_up: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
          symbols: '@#$%^&*()-_=+[]{};:<>/?!£€.,'
        }
      }

      const opts = _.defaults(
        window.passwordStrengthOptions || {},
        defaultPasswordOpts
      )
      if (opts.length.min === 1) {
        opts.acceptRate = 0 // this allows basically anything to be a valid password
      }
      const passField = new PassField.Field('passwordField', opts)

      const [asyncFormCtrl, ngModelCtrl] = Array.from(ctrl)

      return ngModelCtrl.$parsers.unshift(function(modelValue) {
        let isValid = passField.validatePass()
        const email = asyncFormCtrl.getEmail() || window.usersEmail
        if (!isValid) {
          scope.complexPasswordErrorMessage = passField.getPassValidationMessage()
        } else if (email != null && email !== '') {
          const startOfEmail = __guard__(
            email != null ? email.split('@') : undefined,
            x => x[0]
          )
          if (
            modelValue.indexOf(email) !== -1 ||
            modelValue.indexOf(startOfEmail) !== -1
          ) {
            isValid = false
            scope.complexPasswordErrorMessage =
              'Password can not contain email address'
          }
        }
        if (opts.length.max != null && modelValue.length === opts.length.max) {
          isValid = false
          scope.complexPasswordErrorMessage = `Maximum password length ${
            opts.length.max
          } reached`
        }
        if (opts.length.min != null && modelValue.length < opts.length.min) {
          isValid = false
          scope.complexPasswordErrorMessage = `Password too short, minimum ${
            opts.length.min
          }`
        }
        ngModelCtrl.$setValidity('complexPassword', isValid)
        return modelValue
      })
    }
  }))
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
