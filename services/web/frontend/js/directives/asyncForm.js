import App from '../base'
import 'libs/passfield'
App.directive('asyncForm', ($http, validateCaptcha, validateCaptchaV3) => ({
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
      if (attrs.captchaActionName) {
        validateCaptchaV3(attrs.captchaActionName)
      }
      if (attrs.captcha != null) {
        validateCaptcha(callback)
      } else {
        callback()
      }
    }

    const submitRequest = function(grecaptchaResponse) {
      const formData = {}
      for (let data of Array.from(element.serializeArray())) {
        formData[data.name] = data.value
      }

      if (grecaptchaResponse) {
        formData['g-recaptcha-response'] = grecaptchaResponse
      }

      // clear the response object which may be referenced downstream
      Object.keys(response).forEach(field => delete response[field])
      scope[attrs.name].inflight = true

      // for asyncForm prevent automatic redirect to /login if
      // authentication fails, we will handle it ourselves
      const httpRequestFn = _httpRequestFn(element.attr('method'))
      return httpRequestFn(element.attr('action'), formData, {
        disableAutoLoginRedirect: true
      })
        .then(function(httpResponse) {
          const { data, headers } = httpResponse
          scope[attrs.name].inflight = false
          response.success = true
          response.error = false

          const onSuccessHandler = scope[attrs.onSuccess]
          if (onSuccessHandler) {
            onSuccessHandler(httpResponse)
            return
          }

          if (data.redir) {
            ga('send', 'event', formName, 'success')
            return (window.location = data.redir)
          } else if (data.message) {
            response.message = data.message

            if (data.message.type === 'error') {
              response.success = false
              response.error = true
              return ga('send', 'event', formName, 'failure', data.message)
            } else {
              return ga('send', 'event', formName, 'success')
            }
          } else if (scope.$eval(attrs.asyncFormDownloadResponse)) {
            const blob = new Blob([data], {
              type: headers('Content-Type')
            })
            location.href = URL.createObjectURL(blob) // Trigger file save
          }
        })
        .catch(function(httpResponse) {
          const { data, status } = httpResponse
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

          let responseMessage
          if (data.message && data.message.text) {
            responseMessage = data.message.text
          } else {
            responseMessage = data.message
          }

          if (status === 400) {
            // Bad Request
            response.message = {
              text:
                responseMessage ||
                'Invalid Request. Please correct the data and try again.',
              type: 'error'
            }
          } else if (status === 403) {
            // Forbidden
            response.message = {
              text:
                responseMessage ||
                'Session error. Please check you have cookies enabled. If the problem persists, try clearing your cache and cookies.',
              type: 'error'
            }
          } else if (status === 429) {
            response.message = {
              text:
                responseMessage ||
                'Too many attempts. Please wait for a while and try again.',
              type: 'error'
            }
          } else {
            response.message = {
              text:
                responseMessage ||
                'Something went wrong talking to the server :(. Please try again.',
              type: 'error'
            }
          }
          ga('send', 'event', formName, 'failure', data.message)
        })
    }

    const submit = () =>
      validateCaptchaIfEnabled(response => submitRequest(response))

    const _httpRequestFn = (method = 'post') => {
      const $HTTP_FNS = {
        post: $http.post,
        get: $http.get
      }
      return $HTTP_FNS[method.toLowerCase()]
    }

    element.on('submit', function(e) {
      e.preventDefault()
      submit()
    })

    if (attrs.autoSubmit) {
      submit()
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
