/* eslint-disable
    camelcase,
    max-len,
    no-return-assign
*/
/* global recurly,_,define */
define(['base', 'directives/creditCards'], App =>
  App.controller('NewSubscriptionController', function(
    $scope,
    MultiCurrencyPricing,
    $http,
    event_tracking,
    ccUtils
  ) {
    if (typeof recurly === 'undefined' || !recurly) {
      $scope.recurlyLoadError = true
      return
    }

    $scope.recurlyLoadError = false
    $scope.currencyCode = MultiCurrencyPricing.currencyCode
    $scope.allCurrencies = MultiCurrencyPricing.plans
    $scope.availableCurrencies = {}
    $scope.planCode = window.plan_code

    $scope.switchToStudent = function() {
      const currentPlanCode = window.plan_code
      const planCode = currentPlanCode.replace('collaborator', 'student')
      event_tracking.sendMB('subscription-form-switch-to-student', {
        plan: window.plan_code
      })
      event_tracking.send(
        'subscription-funnel',
        'subscription-form-switch-to-student',
        window.plan_code
      )
      window.location = `/user/subscription/new?planCode=${planCode}&currency=${
        $scope.currencyCode
      }&cc=${$scope.data.coupon}`
    }

    event_tracking.sendMB('subscription-form', { plan: window.plan_code })
    event_tracking.send(
      'subscription-funnel',
      'subscription-form-viewed',
      window.plan_code
    )

    $scope.paymentMethod = { value: 'credit_card' }

    $scope.data = {
      first_name: '',
      last_name: '',
      postal_code: '',
      address1: '',
      address2: '',
      state: '',
      city: '',
      country: window.countryCode,
      coupon: window.couponCode
    }

    $scope.validation = {}

    $scope.processing = false

    $scope.threeDSecureFlow = false
    $scope.threeDSecureContainer = document.querySelector(
      '.three-d-secure-container'
    )
    $scope.threeDSecureRecurlyContainer = document.querySelector(
      '.three-d-secure-recurly-container'
    )

    recurly.configure({
      publicKey: window.recurlyApiKey,
      style: {
        all: {
          fontFamily: '"Open Sans", sans-serif',
          fontSize: '16px',
          fontColor: '#7a7a7a'
        },
        month: {
          placeholder: 'MM'
        },
        year: {
          placeholder: 'YY'
        },
        cvv: {
          placeholder: 'CVV'
        }
      }
    })

    const pricing = recurly.Pricing()
    window.pricing = pricing

    pricing
      .plan(window.plan_code, { quantity: 1 })
      .address({ country: $scope.data.country })
      .tax({ tax_code: 'digital', vat_number: '' })
      .currency($scope.currencyCode)
      .coupon($scope.data.coupon)
      .done()

    pricing.on('change', () => {
      $scope.planName = pricing.items.plan.name
      $scope.price = pricing.price
      if (pricing.items.plan.trial) {
        $scope.trialLength = pricing.items.plan.trial.length
      }
      $scope.monthlyBilling = pricing.items.plan.period.length === 1

      $scope.availableCurrencies = {}
      for (let currencyCode in pricing.items.plan.price) {
        if (MultiCurrencyPricing.plans[currencyCode]) {
          $scope.availableCurrencies[currencyCode] =
            MultiCurrencyPricing.plans[currencyCode]
        }
      }

      if (
        pricing.items &&
        pricing.items.coupon &&
        pricing.items.coupon.discount &&
        pricing.items.coupon.discount.type === 'percent'
      ) {
        const basePrice = parseInt(pricing.price.base.plan.unit)
        $scope.normalPrice = basePrice
        if (
          pricing.items.coupon.applies_for_months > 0 &&
          pricing.items.coupon.discount.rate &&
          pricing.items.coupon.applies_for_months
        ) {
          $scope.discountMonths = pricing.items.coupon.applies_for_months
          $scope.discountRate = pricing.items.coupon.discount.rate * 100
        }

        if (pricing.price.taxes[0] && pricing.price.taxes[0].rate) {
          $scope.normalPrice += basePrice * pricing.price.taxes[0].rate
        }
      }
      $scope.$apply()
    })

    $scope.applyCoupon = () => pricing.coupon($scope.data.coupon).done()

    $scope.applyVatNumber = () =>
      pricing
        .tax({ tax_code: 'digital', vat_number: $scope.data.vat_number })
        .done()

    $scope.changeCurrency = function(newCurrency) {
      $scope.currencyCode = newCurrency
      return pricing.currency(newCurrency).done()
    }

    $scope.inputHasError = function(formItem) {
      if (formItem == null) {
        return false
      }

      return formItem.$touched && formItem.$invalid
    }

    $scope.isFormValid = function(form) {
      if ($scope.paymentMethod.value === 'paypal') {
        return $scope.data.country !== ''
      } else {
        return form.$valid
      }
    }

    $scope.updateCountry = () =>
      pricing.address({ country: $scope.data.country }).done()

    $scope.setPaymentMethod = function(method) {
      $scope.paymentMethod.value = method
      $scope.validation.errorFields = {}
      $scope.genericError = ''
    }

    let cachedRecurlyBillingToken
    const completeSubscription = function(
      err,
      recurlyBillingToken,
      recurly3DSecureResultToken
    ) {
      if (recurlyBillingToken) {
        // temporary store the billing token as it might be needed when
        // re-sending the request after SCA authentication
        cachedRecurlyBillingToken = recurlyBillingToken
      }
      $scope.validation.errorFields = {}
      if (err != null) {
        event_tracking.sendMB('subscription-error', err)
        event_tracking.send('subscription-funnel', 'subscription-error')
        // We may or may not be in a digest loop here depending on
        // whether recurly could do validation locally, so do it async
        $scope.$evalAsync(function() {
          $scope.processing = false
          $scope.genericError = err.message
          _.each(
            err.fields,
            field => ($scope.validation.errorFields[field] = true)
          )
        })
      } else {
        const postData = {
          _csrf: window.csrfToken,
          recurly_token_id: cachedRecurlyBillingToken.id,
          recurly_three_d_secure_action_result_token_id:
            recurly3DSecureResultToken && recurly3DSecureResultToken.id,
          subscriptionDetails: {
            currencyCode: pricing.items.currency,
            plan_code: pricing.items.plan.code,
            coupon_code: pricing.items.coupon ? pricing.items.coupon.code : '',
            first_name: $scope.data.first_name,
            last_name: $scope.data.last_name,

            isPaypal: $scope.paymentMethod.value === 'paypal',
            address: {
              address1: $scope.data.address1,
              address2: $scope.data.address2,
              country: $scope.data.country,
              state: $scope.data.state,
              postal_code: $scope.data.postal_code
            }
          }
        }

        event_tracking.sendMB('subscription-form-submitted', {
          currencyCode: postData.subscriptionDetails.currencyCode,
          plan_code: postData.subscriptionDetails.plan_code,
          coupon_code: postData.subscriptionDetails.coupon_code,
          isPaypal: postData.subscriptionDetails.isPaypal
        })
        event_tracking.send(
          'subscription-funnel',
          'subscription-form-submitted',
          postData.subscriptionDetails.plan_code
        )

        return $http
          .post('/user/subscription/create', postData)
          .then(function() {
            event_tracking.sendMB('subscription-submission-success')
            event_tracking.send(
              'subscription-funnel',
              'subscription-submission-success',
              postData.subscriptionDetails.plan_code
            )
            window.location.href = '/user/subscription/thank-you'
          })
          .catch(response => {
            $scope.processing = false
            const { data } = response
            $scope.genericError =
              (data && data.message) ||
              'Something went wrong processing the request'

            if (data.threeDSecureActionTokenId) {
              initThreeDSecure(data.threeDSecureActionTokenId)
            }
          })
      }
    }

    $scope.submit = function() {
      $scope.processing = true
      if ($scope.paymentMethod.value === 'paypal') {
        const opts = { description: $scope.planName }
        return recurly.paypal(opts, completeSubscription)
      } else {
        return recurly.token($scope.data, completeSubscription)
      }
    }

    const initThreeDSecure = function(threeDSecureActionTokenId) {
      // instanciate and configure Recurly 3DSecure flow
      const risk = recurly.Risk()
      const threeDSecure = risk.ThreeDSecure({
        actionTokenId: threeDSecureActionTokenId
      })

      // on SCA verification error: show payment UI with the error message
      threeDSecure.on('error', error => {
        $scope.genericError = `Error: ${error.message}`
        $scope.threeDSecureFlow = false
        $scope.$apply()
      })

      // on SCA verification success: show payment UI in processing mode and
      // resubmit the payment with the new token final success or error will be
      // handled by `completeSubscription`
      threeDSecure.on('token', recurly3DSecureResultToken => {
        completeSubscription(null, null, recurly3DSecureResultToken)
        $scope.genericError = null
        $scope.threeDSecureFlow = false
        $scope.processing = true
        $scope.$apply()
      })

      // make sure the threeDSecureRecurlyContainer is empty (in case of
      // retries) and show 3DSecure UI
      $scope.threeDSecureRecurlyContainer.innerHTML = ''
      $scope.threeDSecureFlow = true
      threeDSecure.attach($scope.threeDSecureRecurlyContainer)

      // scroll the UI into view (timeout needed to make sure the element is
      // visible)
      window.setTimeout(() => {
        $scope.threeDSecureContainer.scrollIntoView()
      }, 0)
    }

    $scope.countries = [
      { code: 'AF', name: 'Afghanistan' },
      { code: 'AL', name: 'Albania' },
      { code: 'DZ', name: 'Algeria' },
      { code: 'AS', name: 'American Samoa' },
      { code: 'AD', name: 'Andorra' },
      { code: 'AO', name: 'Angola' },
      { code: 'AI', name: 'Anguilla' },
      { code: 'AQ', name: 'Antarctica' },
      { code: 'AG', name: 'Antigua and Barbuda' },
      { code: 'AR', name: 'Argentina' },
      { code: 'AM', name: 'Armenia' },
      { code: 'AW', name: 'Aruba' },
      { code: 'AC', name: 'Ascension Island' },
      { code: 'AU', name: 'Australia' },
      { code: 'AT', name: 'Austria' },
      { code: 'AZ', name: 'Azerbaijan' },
      { code: 'BS', name: 'Bahamas' },
      { code: 'BH', name: 'Bahrain' },
      { code: 'BD', name: 'Bangladesh' },
      { code: 'BB', name: 'Barbados' },
      { code: 'BE', name: 'Belgium' },
      { code: 'BZ', name: 'Belize' },
      { code: 'BJ', name: 'Benin' },
      { code: 'BM', name: 'Bermuda' },
      { code: 'BT', name: 'Bhutan' },
      { code: 'BO', name: 'Bolivia' },
      { code: 'BA', name: 'Bosnia and Herzegovina' },
      { code: 'BW', name: 'Botswana' },
      { code: 'BV', name: 'Bouvet Island' },
      { code: 'BR', name: 'Brazil' },
      { code: 'BQ', name: 'British Antarctic Territory' },
      { code: 'IO', name: 'British Indian Ocean Territory' },
      { code: 'VG', name: 'British Virgin Islands' },
      { code: 'BN', name: 'Brunei' },
      { code: 'BG', name: 'Bulgaria' },
      { code: 'BF', name: 'Burkina Faso' },
      { code: 'BI', name: 'Burundi' },
      { code: 'KH', name: 'Cambodia' },
      { code: 'CM', name: 'Cameroon' },
      { code: 'CA', name: 'Canada' },
      { code: 'IC', name: 'Canary Islands' },
      { code: 'CT', name: 'Canton and Enderbury Islands' },
      { code: 'CV', name: 'Cape Verde' },
      { code: 'KY', name: 'Cayman Islands' },
      { code: 'CF', name: 'Central African Republic' },
      { code: 'EA', name: 'Ceuta and Melilla' },
      { code: 'TD', name: 'Chad' },
      { code: 'CL', name: 'Chile' },
      { code: 'CN', name: 'China' },
      { code: 'CX', name: 'Christmas Island' },
      { code: 'CP', name: 'Clipperton Island' },
      { code: 'CC', name: 'Cocos [Keeling] Islands' },
      { code: 'CO', name: 'Colombia' },
      { code: 'KM', name: 'Comoros' },
      { code: 'CD', name: 'Congo [DRC]' },
      { code: 'CK', name: 'Cook Islands' },
      { code: 'CR', name: 'Costa Rica' },
      { code: 'HR', name: 'Croatia' },
      { code: 'CU', name: 'Cuba' },
      { code: 'CY', name: 'Cyprus' },
      { code: 'CZ', name: 'Czech Republic' },
      { code: 'DK', name: 'Denmark' },
      { code: 'DG', name: 'Diego Garcia' },
      { code: 'DJ', name: 'Djibouti' },
      { code: 'DM', name: 'Dominica' },
      { code: 'DO', name: 'Dominican Republic' },
      { code: 'NQ', name: 'Dronning Maud Land' },
      { code: 'TL', name: 'East Timor' },
      { code: 'EC', name: 'Ecuador' },
      { code: 'EG', name: 'Egypt' },
      { code: 'SV', name: 'El Salvador' },
      { code: 'EE', name: 'Estonia' },
      { code: 'ET', name: 'Ethiopia' },
      { code: 'FK', name: 'Falkland Islands [Islas Malvinas]' },
      { code: 'FO', name: 'Faroe Islands' },
      { code: 'FJ', name: 'Fiji' },
      { code: 'FI', name: 'Finland' },
      { code: 'FR', name: 'France' },
      { code: 'GF', name: 'French Guiana' },
      { code: 'PF', name: 'French Polynesia' },
      { code: 'TF', name: 'French Southern Territories' },
      { code: 'FQ', name: 'French Southern and Antarctic Territories' },
      { code: 'GA', name: 'Gabon' },
      { code: 'GM', name: 'Gambia' },
      { code: 'GE', name: 'Georgia' },
      { code: 'DE', name: 'Germany' },
      { code: 'GH', name: 'Ghana' },
      { code: 'GI', name: 'Gibraltar' },
      { code: 'GR', name: 'Greece' },
      { code: 'GL', name: 'Greenland' },
      { code: 'GD', name: 'Grenada' },
      { code: 'GP', name: 'Guadeloupe' },
      { code: 'GU', name: 'Guam' },
      { code: 'GT', name: 'Guatemala' },
      { code: 'GG', name: 'Guernsey' },
      { code: 'GW', name: 'Guinea-Bissau' },
      { code: 'GY', name: 'Guyana' },
      { code: 'HT', name: 'Haiti' },
      { code: 'HM', name: 'Heard Island and McDonald Islands' },
      { code: 'HN', name: 'Honduras' },
      { code: 'HK', name: 'Hong Kong' },
      { code: 'HU', name: 'Hungary' },
      { code: 'IS', name: 'Iceland' },
      { code: 'IN', name: 'India' },
      { code: 'ID', name: 'Indonesia' },
      { code: 'IE', name: 'Ireland' },
      { code: 'IM', name: 'Isle of Man' },
      { code: 'IL', name: 'Israel' },
      { code: 'IT', name: 'Italy' },
      { code: 'JM', name: 'Jamaica' },
      { code: 'JP', name: 'Japan' },
      { code: 'JE', name: 'Jersey' },
      { code: 'JT', name: 'Johnston Island' },
      { code: 'JO', name: 'Jordan' },
      { code: 'KZ', name: 'Kazakhstan' },
      { code: 'KE', name: 'Kenya' },
      { code: 'KI', name: 'Kiribati' },
      { code: 'KW', name: 'Kuwait' },
      { code: 'KG', name: 'Kyrgyzstan' },
      { code: 'LA', name: 'Laos' },
      { code: 'LV', name: 'Latvia' },
      { code: 'LS', name: 'Lesotho' },
      { code: 'LY', name: 'Libya' },
      { code: 'LI', name: 'Liechtenstein' },
      { code: 'LT', name: 'Lithuania' },
      { code: 'LU', name: 'Luxembourg' },
      { code: 'MO', name: 'Macau' },
      { code: 'MK', name: 'Macedonia [FYROM]' },
      { code: 'MG', name: 'Madagascar' },
      { code: 'MW', name: 'Malawi' },
      { code: 'MY', name: 'Malaysia' },
      { code: 'MV', name: 'Maldives' },
      { code: 'ML', name: 'Mali' },
      { code: 'MT', name: 'Malta' },
      { code: 'MH', name: 'Marshall Islands' },
      { code: 'MQ', name: 'Martinique' },
      { code: 'MR', name: 'Mauritania' },
      { code: 'MU', name: 'Mauritius' },
      { code: 'YT', name: 'Mayotte' },
      { code: 'FX', name: 'Metropolitan France' },
      { code: 'MX', name: 'Mexico' },
      { code: 'FM', name: 'Micronesia' },
      { code: 'MI', name: 'Midway Islands' },
      { code: 'MD', name: 'Moldova' },
      { code: 'MC', name: 'Monaco' },
      { code: 'MN', name: 'Mongolia' },
      { code: 'ME', name: 'Montenegro' },
      { code: 'MS', name: 'Montserrat' },
      { code: 'MA', name: 'Morocco' },
      { code: 'MZ', name: 'Mozambique' },
      { code: 'NA', name: 'Namibia' },
      { code: 'NR', name: 'Nauru' },
      { code: 'NP', name: 'Nepal' },
      { code: 'NL', name: 'Netherlands' },
      { code: 'AN', name: 'Netherlands Antilles' },
      { code: 'NT', name: 'Neutral Zone' },
      { code: 'NC', name: 'New Caledonia' },
      { code: 'NZ', name: 'New Zealand' },
      { code: 'NI', name: 'Nicaragua' },
      { code: 'NE', name: 'Niger' },
      { code: 'NG', name: 'Nigeria' },
      { code: 'NU', name: 'Niue' },
      { code: 'NF', name: 'Norfolk Island' },
      { code: 'VD', name: 'North Vietnam' },
      { code: 'MP', name: 'Northern Mariana Islands' },
      { code: 'NO', name: 'Norway' },
      { code: 'OM', name: 'Oman' },
      { code: 'QO', name: 'Outlying Oceania' },
      { code: 'PC', name: 'Pacific Islands Trust Territory' },
      { code: 'PK', name: 'Pakistan' },
      { code: 'PW', name: 'Palau' },
      { code: 'PS', name: 'Palestinian Territories' },
      { code: 'PA', name: 'Panama' },
      { code: 'PZ', name: 'Panama Canal Zone' },
      { code: 'PY', name: 'Paraguay' },
      { code: 'YD', name: 'People&apos;s Democratic Republic of Yemen' },
      { code: 'PE', name: 'Peru' },
      { code: 'PH', name: 'Philippines' },
      { code: 'PN', name: 'Pitcairn Islands' },
      { code: 'PL', name: 'Poland' },
      { code: 'PT', name: 'Portugal' },
      { code: 'PR', name: 'Puerto Rico' },
      { code: 'QA', name: 'Qatar' },
      { code: 'RO', name: 'Romania' },
      { code: 'RU', name: 'Russia' },
      { code: 'RW', name: 'Rwanda' },
      { code: 'RE', name: 'R&eacute;union' },
      { code: 'BL', name: 'Saint Barth&eacute;lemy' },
      { code: 'SH', name: 'Saint Helena' },
      { code: 'KN', name: 'Saint Kitts and Nevis' },
      { code: 'LC', name: 'Saint Lucia' },
      { code: 'MF', name: 'Saint Martin' },
      { code: 'PM', name: 'Saint Pierre and Miquelon' },
      { code: 'VC', name: 'Saint Vincent and the Grenadines' },
      { code: 'WS', name: 'Samoa' },
      { code: 'SM', name: 'San Marino' },
      { code: 'SA', name: 'Saudi Arabia' },
      { code: 'SN', name: 'Senegal' },
      { code: 'RS', name: 'Serbia' },
      { code: 'CS', name: 'Serbia and Montenegro' },
      { code: 'SC', name: 'Seychelles' },
      { code: 'SL', name: 'Sierra Leone' },
      { code: 'SG', name: 'Singapore' },
      { code: 'SK', name: 'Slovakia' },
      { code: 'SI', name: 'Slovenia' },
      { code: 'SB', name: 'Solomon Islands' },
      { code: 'ZA', name: 'South Africa' },
      { code: 'GS', name: 'South Georgia and the South Sandwich Islands' },
      { code: 'KR', name: 'South Korea' },
      { code: 'ES', name: 'Spain' },
      { code: 'LK', name: 'Sri Lanka' },
      { code: 'SR', name: 'Suriname' },
      { code: 'SJ', name: 'Svalbard and Jan Mayen' },
      { code: 'SZ', name: 'Swaziland' },
      { code: 'SE', name: 'Sweden' },
      { code: 'CH', name: 'Switzerland' },
      { code: 'ST', name: 'S&atilde;o Tom&eacute; and Pr&iacute;ncipe' },
      { code: 'TW', name: 'Taiwan' },
      { code: 'TJ', name: 'Tajikistan' },
      { code: 'TZ', name: 'Tanzania' },
      { code: 'TH', name: 'Thailand' },
      { code: 'TG', name: 'Togo' },
      { code: 'TK', name: 'Tokelau' },
      { code: 'TO', name: 'Tonga' },
      { code: 'TT', name: 'Trinidad and Tobago' },
      { code: 'TA', name: 'Tristan da Cunha' },
      { code: 'TN', name: 'Tunisia' },
      { code: 'TR', name: 'Turkey' },
      { code: 'TM', name: 'Turkmenistan' },
      { code: 'TC', name: 'Turks and Caicos Islands' },
      { code: 'TV', name: 'Tuvalu' },
      { code: 'UM', name: 'U.S. Minor Outlying Islands' },
      { code: 'PU', name: 'U.S. Miscellaneous Pacific Islands' },
      { code: 'VI', name: 'U.S. Virgin Islands' },
      { code: 'UG', name: 'Uganda' },
      { code: 'UA', name: 'Ukraine' },
      { code: 'AE', name: 'United Arab Emirates' },
      { code: 'GB', name: 'United Kingdom' },
      { code: 'US', name: 'United States' },
      { code: 'UY', name: 'Uruguay' },
      { code: 'UZ', name: 'Uzbekistan' },
      { code: 'VU', name: 'Vanuatu' },
      { code: 'VA', name: 'Vatican City' },
      { code: 'VE', name: 'Venezuela' },
      { code: 'VN', name: 'Vietnam' },
      { code: 'WK', name: 'Wake Island' },
      { code: 'WF', name: 'Wallis and Futuna' },
      { code: 'EH', name: 'Western Sahara' },
      { code: 'YE', name: 'Yemen' },
      { code: 'ZM', name: 'Zambia' },
      { code: 'AX', name: '&angst;land Islandscode:' }
    ]
  }))
