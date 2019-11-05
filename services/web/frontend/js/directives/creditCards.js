/* eslint-disable
    max-len,
    no-undef,
    no-useless-escape,
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
define(['base'], function(App) {
  App.factory('ccUtils', function() {
    const defaultFormat = /(\d{1,4})/g
    const defaultInputFormat = /(?:^|\s)(\d{4})$/

    const cards = [
      // Credit cards
      {
        type: 'visa',
        patterns: [4],
        format: defaultFormat,
        length: [13, 16],
        cvcLength: [3],
        luhn: true
      },
      {
        type: 'mastercard',
        patterns: [51, 52, 53, 54, 55, 22, 23, 24, 25, 26, 27],
        format: defaultFormat,
        length: [16],
        cvcLength: [3],
        luhn: true
      },
      {
        type: 'amex',
        patterns: [34, 37],
        format: /(\d{1,4})(\d{1,6})?(\d{1,5})?/,
        length: [15],
        cvcLength: [3, 4],
        luhn: true
      },
      {
        type: 'dinersclub',
        patterns: [30, 36, 38, 39],
        format: /(\d{1,4})(\d{1,6})?(\d{1,4})?/,
        length: [14],
        cvcLength: [3],
        luhn: true
      },
      {
        type: 'discover',
        patterns: [60, 64, 65, 622],
        format: defaultFormat,
        length: [16],
        cvcLength: [3],
        luhn: true
      },
      {
        type: 'unionpay',
        patterns: [62, 88],
        format: defaultFormat,
        length: [16, 17, 18, 19],
        cvcLength: [3],
        luhn: false
      },
      {
        type: 'jcb',
        patterns: [35],
        format: defaultFormat,
        length: [16],
        cvcLength: [3],
        luhn: true
      }
    ]

    const cardFromNumber = function(num) {
      num = (num + '').replace(/\D/g, '')
      for (let card of Array.from(cards)) {
        for (let pattern of Array.from(card.patterns)) {
          const p = pattern + ''
          if (num.substr(0, p.length) === p) {
            return card
          }
        }
      }
    }

    const cardFromType = function(type) {
      for (let card of Array.from(cards)) {
        if (card.type === type) {
          return card
        }
      }
    }

    const cardType = function(num) {
      if (!num) {
        return null
      }
      return __guard__(cardFromNumber(num), x => x.type) || null
    }

    const formatCardNumber = function(num) {
      num = num.replace(/\D/g, '')
      const card = cardFromNumber(num)
      if (!card) {
        return num
      }

      const upperLength = card.length[card.length.length - 1]
      num = num.slice(0, upperLength)

      if (card.format.global) {
        return __guard__(num.match(card.format), x => x.join(' '))
      } else {
        let groups = card.format.exec(num)
        if (groups == null) {
          return
        }
        groups.shift()
        groups = $.grep(groups, n => n) // Filter empty groups
        return groups.join(' ')
      }
    }

    const formatExpiry = function(expiry) {
      const parts = expiry.match(/^\D*(\d{1,2})(\D+)?(\d{1,4})?/)
      if (!parts) {
        return ''
      }

      let mon = parts[1] || ''
      let sep = parts[2] || ''
      const year = parts[3] || ''

      if (year.length > 0) {
        sep = ' / '
      } else if (sep === ' /') {
        mon = mon.substring(0, 1)
        sep = ''
      } else if (mon.length === 2 || sep.length > 0) {
        sep = ' / '
      } else if (mon.length === 1 && !['0', '1'].includes(mon)) {
        mon = `0${mon}`
        sep = ' / '
      }

      return mon + sep + year
    }

    const parseExpiry = function(value) {
      if (value == null) {
        value = ''
      }
      let [month, year] = Array.from(value.split(/[\s\/]+/, 2))

      // Allow for year shortcut
      if (
        (year != null ? year.length : undefined) === 2 &&
        /^\d+$/.test(year)
      ) {
        let prefix = new Date().getFullYear()
        prefix = prefix.toString().slice(0, 2)
        year = prefix + year
      }

      month = parseInt(month, 10)
      year = parseInt(year, 10)

      if (!!isNaN(month) || !!isNaN(year)) {
        return
      }

      return { month, year }
    }

    return {
      fromNumber: cardFromNumber,
      fromType: cardFromType,
      cardType,
      formatExpiry,
      formatCardNumber,
      defaultFormat,
      defaultInputFormat,
      parseExpiry
    }
  })

  App.factory('ccFormat', function(ccUtils, $filter) {
    const hasTextSelected = function($target) {
      // If some text is selected
      if (
        $target.prop('selectionStart') != null &&
        $target.prop('selectionStart') !== $target.prop('selectionEnd')
      ) {
        return true
      }

      // If some text is selected in IE
      if (
        __guard__(
          typeof document !== 'undefined' && document !== null
            ? document.selection
            : undefined,
          x => x.createRange
        ) != null
      ) {
        if (document.selection.createRange().text) {
          return true
        }
      }

      return false
    }

    const safeVal = function(value, $target) {
      let cursor
      try {
        cursor = $target.prop('selectionStart')
      } catch (error) {
        cursor = null
      }

      const last = $target.val()
      $target.val(value)

      if (cursor !== null && $target.is(':focus')) {
        if (cursor === last.length) {
          cursor = value.length
        }

        // This hack looks for scenarios where we are changing an input's value such
        // that "X| " is replaced with " |X" (where "|" is the cursor). In those
        // scenarios, we want " X|".
        //
        // For example:
        // 1. Input field has value "4444| "
        // 2. User types "1"
        // 3. Input field has value "44441| "
        // 4. Reformatter changes it to "4444 |1"
        // 5. By incrementing the cursor, we make it "4444 1|"
        //
        // This is awful, and ideally doesn't go here, but given the current design
        // of the system there does not appear to be a better solution.
        //
        // Note that we can't just detect when the cursor-1 is " ", because that
        // would incorrectly increment the cursor when backspacing, e.g. pressing
        // backspace in this scenario: "4444 1|234 5".
        if (last !== value) {
          const prevPair = last.slice(cursor - 1, +cursor + 1 || undefined)
          const currPair = value.slice(cursor - 1, +cursor + 1 || undefined)
          const digit = value[cursor]
          if (
            /\d/.test(digit) &&
            prevPair === `${digit} ` &&
            currPair === ` ${digit}`
          ) {
            cursor = cursor + 1
          }
        }

        $target.prop('selectionStart', cursor)
        return $target.prop('selectionEnd', cursor)
      }
    }

    // Replace Full-Width Chars
    const replaceFullWidthChars = function(str) {
      if (str == null) {
        str = ''
      }
      const fullWidth =
        '\uff10\uff11\uff12\uff13\uff14\uff15\uff16\uff17\uff18\uff19'
      const halfWidth = '0123456789'

      let value = ''
      const chars = str.split('')

      // Avoid using reserved word `char`
      for (let chr of Array.from(chars)) {
        const idx = fullWidth.indexOf(chr)
        if (idx > -1) {
          chr = halfWidth[idx]
        }
        value += chr
      }

      return value
    }

    // Format Numeric
    const reFormatNumeric = function(e) {
      const $target = $(e.currentTarget)
      return setTimeout(function() {
        let value = $target.val()
        value = replaceFullWidthChars(value)
        value = value.replace(/\D/g, '')
        return safeVal(value, $target)
      })
    }

    // Format Card Number
    const reFormatCardNumber = function(e) {
      const $target = $(e.currentTarget)
      return setTimeout(function() {
        let value = $target.val()
        value = replaceFullWidthChars(value)
        value = ccUtils.formatCardNumber(value)
        return safeVal(value, $target)
      })
    }

    const formatCardNumber = function(e) {
      // Only format if input is a number
      let re
      const digit = String.fromCharCode(e.which)
      if (!/^\d+$/.test(digit)) {
        return
      }

      const $target = $(e.currentTarget)
      const value = $target.val()
      const card = ccUtils.fromNumber(value + digit)
      const { length } = value.replace(/\D/g, '') + digit

      let upperLength = 16
      if (card) {
        upperLength = card.length[card.length.length - 1]
      }
      if (length >= upperLength) {
        return
      }

      // Return if focus isn't at the end of the text
      if (
        $target.prop('selectionStart') != null &&
        $target.prop('selectionStart') !== value.length
      ) {
        return
      }

      if (card && card.type === 'amex') {
        // AMEX cards are formatted differently
        re = /^(\d{4}|\d{4}\s\d{6})$/
      } else {
        re = /(?:^|\s)(\d{4})$/
      }

      // If '4242' + 4
      if (re.test(value)) {
        e.preventDefault()
        return setTimeout(() => $target.val(value + ' ' + digit))

        // If '424' + 2
      } else if (re.test(value + digit)) {
        e.preventDefault()
        return setTimeout(() => $target.val(value + digit + ' '))
      }
    }

    const formatBackCardNumber = function(e) {
      const $target = $(e.currentTarget)
      const value = $target.val()

      // Return unless backspacing
      if (e.which !== 8) {
        return
      }

      // Return if focus isn't at the end of the text
      if (
        $target.prop('selectionStart') != null &&
        $target.prop('selectionStart') !== value.length
      ) {
        return
      }

      // Remove the digit + trailing space
      if (/\d\s$/.test(value)) {
        e.preventDefault()
        return setTimeout(() => $target.val(value.replace(/\d\s$/, '')))
        // Remove digit if ends in space + digit
      } else if (/\s\d?$/.test(value)) {
        e.preventDefault()
        return setTimeout(() => $target.val(value.replace(/\d$/, '')))
      }
    }

    const getFormattedCardNumber = function(num) {
      num = num.replace(/\D/g, '')
      const card = ccUtils.fromNumber(num)
      if (!card) {
        return num
      }

      const upperLength = card.length[card.length.length - 1]
      num = num.slice(0, upperLength)

      if (card.format.global) {
        return __guard__(num.match(card.format), x => x.join(' '))
      } else {
        let groups = card.format.exec(num)
        if (groups == null) {
          return
        }
        groups.shift()
        groups = $.grep(groups, n => n) // Filter empty groups
        return groups.join(' ')
      }
    }

    const parseCardNumber = function(value) {
      if (value != null) {
        return value.replace(/\s/g, '')
      } else {
        return value
      }
    }

    // Format Expiry
    const reFormatExpiry = function(e) {
      const $target = $(e.currentTarget)
      return setTimeout(function() {
        let value = $target.val()
        value = replaceFullWidthChars(value)
        value = ccUtils.formatExpiry(value)
        return safeVal(value, $target)
      })
    }

    const formatExpiry = function(e) {
      // Only format if input is a number
      const digit = String.fromCharCode(e.which)
      if (!/^\d+$/.test(digit)) {
        return
      }

      const $target = $(e.currentTarget)
      const val = $target.val() + digit

      if (/^\d$/.test(val) && !['0', '1'].includes(val)) {
        e.preventDefault()
        return setTimeout(() => $target.val(`0${val} / `))
      } else if (/^\d\d$/.test(val)) {
        e.preventDefault()
        return setTimeout(function() {
          // Split for months where we have the second digit > 2 (past 12) and turn
          // that into (m1)(m2) => 0(m1) / (m2)
          const m1 = parseInt(val[0], 10)
          const m2 = parseInt(val[1], 10)
          if (m2 > 2 && m1 !== 0) {
            return $target.val(`0${m1} / ${m2}`)
          } else {
            return $target.val(`${val} / `)
          }
        })
      }
    }

    const formatForwardExpiry = function(e) {
      const digit = String.fromCharCode(e.which)
      if (!/^\d+$/.test(digit)) {
        return
      }

      const $target = $(e.currentTarget)
      const val = $target.val()

      if (/^\d\d$/.test(val)) {
        return $target.val(`${val} / `)
      }
    }

    const formatForwardSlash = function(e) {
      const which = String.fromCharCode(e.which)
      if (which !== '/' && which !== ' ') {
        return
      }

      const $target = $(e.currentTarget)
      const val = $target.val()

      if (/^\d$/.test(val) && val !== '0') {
        return $target.val(`0${val} / `)
      }
    }

    const formatBackExpiry = function(e) {
      const $target = $(e.currentTarget)
      const value = $target.val()

      // Return unless backspacing
      if (e.which !== 8) {
        return
      }

      // Return if focus isn't at the end of the text
      if (
        $target.prop('selectionStart') != null &&
        $target.prop('selectionStart') !== value.length
      ) {
        return
      }

      // Remove the trailing space + last digit
      if (/\d\s\/\s$/.test(value)) {
        e.preventDefault()
        return setTimeout(() => $target.val(value.replace(/\d\s\/\s$/, '')))
      }
    }

    const parseExpiry = function(value) {
      if (value != null) {
        const dateAsObj = ccUtils.parseExpiry(value)

        if (dateAsObj == null) {
          return
        }

        const expiry = new Date(dateAsObj.year, dateAsObj.month - 1)

        return $filter('date')(expiry, 'MM/yyyy')
      }
    }

    // Format CVC
    const reFormatCVC = function(e) {
      const $target = $(e.currentTarget)
      return setTimeout(function() {
        let value = $target.val()
        value = replaceFullWidthChars(value)
        value = value.replace(/\D/g, '').slice(0, 4)
        return safeVal(value, $target)
      })
    }

    // Restrictions
    const restrictNumeric = function(e) {
      // Key event is for a browser shortcut
      if (e.metaKey || e.ctrlKey) {
        return true
      }

      // If keycode is a space
      if (e.which === 32) {
        return false
      }

      // If keycode is a special char (WebKit)
      if (e.which === 0) {
        return true
      }

      // If char is a special char (Firefox)
      if (e.which < 33) {
        return true
      }

      const input = String.fromCharCode(e.which)

      // Char is a number or a space
      return !!/[\d\s]/.test(input)
    }

    const restrictCardNumber = function(e) {
      const $target = $(e.currentTarget)
      const digit = String.fromCharCode(e.which)
      if (!/^\d+$/.test(digit)) {
        return
      }

      if (hasTextSelected($target)) {
        return
      }

      // Restrict number of digits
      const value = ($target.val() + digit).replace(/\D/g, '')
      const card = ccUtils.fromNumber(value)

      if (card) {
        return value.length <= card.length[card.length.length - 1]
      } else {
        // All other cards are 16 digits long
        return value.length <= 16
      }
    }

    const restrictExpiry = function(e) {
      const $target = $(e.currentTarget)
      const digit = String.fromCharCode(e.which)
      if (!/^\d+$/.test(digit)) {
        return
      }

      if (hasTextSelected($target)) {
        return
      }

      let value = $target.val() + digit
      value = value.replace(/\D/g, '')

      if (value.length > 6) {
        return false
      }
    }

    const restrictCVC = function(e) {
      const $target = $(e.currentTarget)
      const digit = String.fromCharCode(e.which)
      if (!/^\d+$/.test(digit)) {
        return
      }

      if (hasTextSelected($target)) {
        return
      }

      const val = $target.val() + digit
      return val.length <= 4
    }

    const setCardType = function(e) {
      const $target = $(e.currentTarget)
      const val = $target.val()
      const cardType = ccUtils.cardType(val) || 'unknown'

      if (!$target.hasClass(cardType)) {
        const allTypes = Array.from(cards).map(card => card.type)

        $target.removeClass('unknown')
        $target.removeClass(allTypes.join(' '))

        $target.addClass(cardType)
        $target.toggleClass('identified', cardType !== 'unknown')
        return $target.trigger('payment.cardType', cardType)
      }
    }

    return {
      hasTextSelected,
      replaceFullWidthChars,
      reFormatNumeric,
      reFormatCardNumber,
      formatCardNumber,
      formatBackCardNumber,
      getFormattedCardNumber,
      parseCardNumber,
      reFormatExpiry,
      formatExpiry,
      formatForwardExpiry,
      formatForwardSlash,
      formatBackExpiry,
      parseExpiry,
      reFormatCVC,
      restrictNumeric,
      restrictCardNumber,
      restrictExpiry,
      restrictCVC,
      setCardType
    }
  })

  App.directive('ccFormatExpiry', ccFormat => ({
    restrict: 'A',
    require: 'ngModel',
    link(scope, el, attrs, ngModel) {
      el.on('keypress', ccFormat.restrictNumeric)
      el.on('keypress', ccFormat.restrictExpiry)
      el.on('keypress', ccFormat.formatExpiry)
      el.on('keypress', ccFormat.formatForwardSlash)
      el.on('keypress', ccFormat.formatForwardExpiry)
      el.on('keydown', ccFormat.formatBackExpiry)
      el.on('change', ccFormat.reFormatExpiry)
      el.on('input', ccFormat.reFormatExpiry)
      el.on('paste', ccFormat.reFormatExpiry)

      ngModel.$parsers.push(ccFormat.parseExpiry)
      return ngModel.$formatters.push(ccFormat.parseExpiry)
    }
  }))

  App.directive('ccFormatCardNumber', ccFormat => ({
    restrict: 'A',
    require: 'ngModel',
    link(scope, el, attrs, ngModel) {
      el.on('keypress', ccFormat.restrictNumeric)
      el.on('keypress', ccFormat.restrictCardNumber)
      el.on('keypress', ccFormat.formatCardNumber)
      el.on('keydown', ccFormat.formatBackCardNumber)
      el.on('paste', ccFormat.reFormatCardNumber)

      ngModel.$parsers.push(ccFormat.parseCardNumber)
      return ngModel.$formatters.push(ccFormat.getFormattedCardNumber)
    }
  }))

  return App.directive('ccFormatSecCode', ccFormat => ({
    restrict: 'A',
    require: 'ngModel',
    link(scope, el, attrs, ngModel) {
      el.on('keypress', ccFormat.restrictNumeric)
      el.on('keypress', ccFormat.restrictCVC)
      el.on('paste', ccFormat.reFormatCVC)
      el.on('change', ccFormat.reFormatCVC)
      return el.on('input', ccFormat.reFormatCVC)
    }
  }))
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
