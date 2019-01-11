/* eslint-disable
    no-undef,
    max-len
*/
define(['base', 'libs/passfield'], function(App) {
  App.directive('complexPassword', () => ({
    require: ['^asyncForm', 'ngModel'],

    link(scope, element, attrs, ctrl) {
      PassField.Config.blackList = []
      const defaultPasswordOpts = {
        pattern: '',
        length: {
          min: 6,
          max: 72
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
        // this allows basically anything to be a valid password
        opts.acceptRate = 0
      }

      if (opts.length.max > 72) {
        // there is a hard limit of 71 characters in the password at the backend
        opts.length.max = 72
      }

      if (opts.length.max > 0) {
        // PassField's notion of 'max' is non-inclusive
        opts.length.max += 1
      }

      const passField = new PassField.Field('passwordField', opts)
      const [asyncFormCtrl, ngModelCtrl] = Array.from(ctrl)

      ngModelCtrl.$parsers.unshift(function(modelValue) {
        let isValid = passField.validatePass()
        const email = asyncFormCtrl.getEmail() || window.usersEmail

        if (!isValid) {
          scope.complexPasswordErrorMessage = passField.getPassValidationMessage()
        } else if (typeof email === 'string' && email !== '') {
          const startOfEmail = email.split('@')[0]
          if (
            modelValue.indexOf(email) !== -1 ||
            modelValue.indexOf(startOfEmail) !== -1
          ) {
            isValid = false
            scope.complexPasswordErrorMessage =
              'Password can not contain email address'
          }
        }
        if (opts.length.max != null && modelValue.length >= opts.length.max) {
          isValid = false
          scope.complexPasswordErrorMessage = `Maximum password length ${opts
            .length.max - 1} exceeded`
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
