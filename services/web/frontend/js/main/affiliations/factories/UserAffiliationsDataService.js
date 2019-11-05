/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], function(App) {
  const countriesList = [
    { code: 'af', name: 'Afghanistan' },
    { code: 'ax', name: 'Åland Islands' },
    { code: 'al', name: 'Albania' },
    { code: 'dz', name: 'Algeria' },
    { code: 'as', name: 'American Samoa' },
    { code: 'ad', name: 'Andorra' },
    { code: 'ao', name: 'Angola' },
    { code: 'ai', name: 'Anguilla' },
    { code: 'aq', name: 'Antarctica' },
    { code: 'ag', name: 'Antigua and Barbuda' },
    { code: 'ar', name: 'Argentina' },
    { code: 'am', name: 'Armenia' },
    { code: 'aw', name: 'Aruba' },
    { code: 'au', name: 'Australia' },
    { code: 'at', name: 'Austria' },
    { code: 'az', name: 'Azerbaijan' },
    { code: 'bs', name: 'Bahamas' },
    { code: 'bh', name: 'Bahrain' },
    { code: 'bd', name: 'Bangladesh' },
    { code: 'bb', name: 'Barbados' },
    { code: 'by', name: 'Belarus' },
    { code: 'be', name: 'Belgium' },
    { code: 'bz', name: 'Belize' },
    { code: 'bj', name: 'Benin' },
    { code: 'bm', name: 'Bermuda' },
    { code: 'bt', name: 'Bhutan' },
    { code: 'bo', name: 'Bolivia' },
    { code: 'bq', name: 'Bonaire, Saint Eustatius and Saba' },
    { code: 'ba', name: 'Bosnia and Herzegovina' },
    { code: 'bw', name: 'Botswana' },
    { code: 'bv', name: 'Bouvet Island' },
    { code: 'br', name: 'Brazil' },
    { code: 'io', name: 'British Indian Ocean Territory' },
    { code: 'vg', name: 'British Virgin Islands' },
    { code: 'bn', name: 'Brunei' },
    { code: 'bg', name: 'Bulgaria' },
    { code: 'bf', name: 'Burkina Faso' },
    { code: 'bi', name: 'Burundi' },
    { code: 'kh', name: 'Cambodia' },
    { code: 'cm', name: 'Cameroon' },
    { code: 'ca', name: 'Canada' },
    { code: 'cv', name: 'Cabo Verde' },
    { code: 'ky', name: 'Cayman Islands' },
    { code: 'cf', name: 'Central African Republic' },
    { code: 'td', name: 'Chad' },
    { code: 'cl', name: 'Chile' },
    { code: 'cn', name: 'China' },
    { code: 'cx', name: 'Christmas Island' },
    { code: 'cc', name: 'Cocos (Keeling) Islands' },
    { code: 'co', name: 'Colombia' },
    { code: 'km', name: 'Comoros' },
    { code: 'cg', name: 'Congo' },
    { code: 'ck', name: 'Cook Islands' },
    { code: 'cr', name: 'Costa Rica' },
    { code: 'ci', name: "Côte d'Ivoire" },
    { code: 'hr', name: 'Croatia' },
    { code: 'cu', name: 'Cuba' },
    { code: 'cw', name: 'Curaçao' },
    { code: 'cy', name: 'Cyprus' },
    { code: 'cz', name: 'Czech Republic' },
    { code: 'kp', name: "Democratic People's Republic of Korea" },
    { code: 'cd', name: 'Democratic Republic of the Congo' },
    { code: 'dk', name: 'Denmark' },
    { code: 'dj', name: 'Djibouti' },
    { code: 'dm', name: 'Dominica' },
    { code: 'do', name: 'Dominican Republic' },
    { code: 'ec', name: 'Ecuador' },
    { code: 'eg', name: 'Egypt' },
    { code: 'sv', name: 'El Salvador' },
    { code: 'gq', name: 'Equatorial Guinea' },
    { code: 'er', name: 'Eritrea' },
    { code: 'ee', name: 'Estonia' },
    { code: 'et', name: 'Ethiopia' },
    { code: 'fk', name: 'Falkland Islands (Malvinas)' },
    { code: 'fo', name: 'Faroe Islands' },
    { code: 'fj', name: 'Fiji' },
    { code: 'fi', name: 'Finland' },
    { code: 'fr', name: 'France' },
    { code: 'gf', name: 'French Guiana' },
    { code: 'pf', name: 'French Polynesia' },
    { code: 'tf', name: 'French Southern Territories' },
    { code: 'ga', name: 'Gabon' },
    { code: 'gm', name: 'Gambia' },
    { code: 'ge', name: 'Georgia' },
    { code: 'de', name: 'Germany' },
    { code: 'gh', name: 'Ghana' },
    { code: 'gi', name: 'Gibraltar' },
    { code: 'gr', name: 'Greece' },
    { code: 'gl', name: 'Greenland' },
    { code: 'gd', name: 'Grenada' },
    { code: 'gp', name: 'Guadeloupe' },
    { code: 'gu', name: 'Guam' },
    { code: 'gt', name: 'Guatemala' },
    { code: 'gg', name: 'Guernsey' },
    { code: 'gn', name: 'Guinea' },
    { code: 'gw', name: 'Guinea-Bissau' },
    { code: 'gy', name: 'Guyana' },
    { code: 'ht', name: 'Haiti' },
    { code: 'hm', name: 'Heard Island and McDonald Islands' },
    { code: 'va', name: 'Holy See (Vatican City)' },
    { code: 'hn', name: 'Honduras' },
    { code: 'hk', name: 'Hong Kong' },
    { code: 'hu', name: 'Hungary' },
    { code: 'is', name: 'Iceland' },
    { code: 'in', name: 'India' },
    { code: 'id', name: 'Indonesia' },
    { code: 'ir', name: 'Iran' },
    { code: 'iq', name: 'Iraq' },
    { code: 'ie', name: 'Ireland' },
    { code: 'im', name: 'Isle of Man' },
    { code: 'il', name: 'Israel' },
    { code: 'it', name: 'Italy' },
    { code: 'jm', name: 'Jamaica' },
    { code: 'jp', name: 'Japan' },
    { code: 'je', name: 'Jersey' },
    { code: 'jo', name: 'Jordan' },
    { code: 'kz', name: 'Kazakhstan' },
    { code: 'ke', name: 'Kenya' },
    { code: 'ki', name: 'Kiribati' },
    { code: 'xk', name: 'Kosovo' },
    { code: 'kw', name: 'Kuwait' },
    { code: 'kg', name: 'Kyrgyzstan' },
    { code: 'la', name: 'Laos' },
    { code: 'lv', name: 'Latvia' },
    { code: 'lb', name: 'Lebanon' },
    { code: 'ls', name: 'Lesotho' },
    { code: 'lr', name: 'Liberia' },
    { code: 'ly', name: 'Libya' },
    { code: 'li', name: 'Liechtenstein' },
    { code: 'lt', name: 'Lithuania' },
    { code: 'lu', name: 'Luxembourg' },
    { code: 'mo', name: 'Macao' },
    { code: 'mk', name: 'Macedonia' },
    { code: 'mg', name: 'Madagascar' },
    { code: 'mw', name: 'Malawi' },
    { code: 'my', name: 'Malaysia' },
    { code: 'mv', name: 'Maldives' },
    { code: 'ml', name: 'Mali' },
    { code: 'mt', name: 'Malta' },
    { code: 'mh', name: 'Marshall Islands' },
    { code: 'mq', name: 'Martinique' },
    { code: 'mr', name: 'Mauritania' },
    { code: 'mu', name: 'Mauritius' },
    { code: 'yt', name: 'Mayotte' },
    { code: 'mx', name: 'Mexico' },
    { code: 'fm', name: 'Micronesia' },
    { code: 'md', name: 'Moldova' },
    { code: 'mc', name: 'Monaco' },
    { code: 'mn', name: 'Mongolia' },
    { code: 'me', name: 'Montenegro' },
    { code: 'ms', name: 'Montserrat' },
    { code: 'ma', name: 'Morocco' },
    { code: 'mz', name: 'Mozambique' },
    { code: 'mm', name: 'Myanmar' },
    { code: 'na', name: 'Namibia' },
    { code: 'nr', name: 'Nauru' },
    { code: 'np', name: 'Nepal' },
    { code: 'nl', name: 'Netherlands' },
    { code: 'an', name: 'Netherlands Antilles' },
    { code: 'nc', name: 'New Caledonia' },
    { code: 'nz', name: 'New Zealand' },
    { code: 'ni', name: 'Nicaragua' },
    { code: 'ne', name: 'Niger' },
    { code: 'ng', name: 'Nigeria' },
    { code: 'nu', name: 'Niue' },
    { code: 'nf', name: 'Norfolk Island' },
    { code: 'mp', name: 'Northern Mariana Islands' },
    { code: 'no', name: 'Norway' },
    { code: 'om', name: 'Oman' },
    { code: 'pk', name: 'Pakistan' },
    { code: 'pw', name: 'Palau' },
    { code: 'ps', name: 'Palestine' },
    { code: 'pa', name: 'Panama' },
    { code: 'pg', name: 'Papua New Guinea' },
    { code: 'py', name: 'Paraguay' },
    { code: 'pe', name: 'Peru' },
    { code: 'ph', name: 'Philippines' },
    { code: 'pn', name: 'Pitcairn' },
    { code: 'pl', name: 'Poland' },
    { code: 'pt', name: 'Portugal' },
    { code: 'pr', name: 'Puerto Rico' },
    { code: 'qa', name: 'Qatar' },
    { code: 'kr', name: 'Republic of Korea' },
    { code: 're', name: 'Réunion' },
    { code: 'ro', name: 'Romania' },
    { code: 'ru', name: 'Russia' },
    { code: 'rw', name: 'Rwanda' },
    { code: 'bl', name: 'Saint Barthélemy' },
    { code: 'sh', name: 'Saint Helena, Ascension and Tristan da Cunha' },
    { code: 'kn', name: 'Saint Kitts and Nevis' },
    { code: 'lc', name: 'Saint Lucia' },
    { code: 'mf', name: 'Saint Martin' },
    { code: 'pm', name: 'Saint Pierre and Miquelon' },
    { code: 'vc', name: 'Saint Vincent and the Grenadines' },
    { code: 'ws', name: 'Samoa' },
    { code: 'sm', name: 'San Marino' },
    { code: 'st', name: 'Sao Tome and Principe' },
    { code: 'sa', name: 'Saudi Arabia' },
    { code: 'sn', name: 'Senegal' },
    { code: 'rs', name: 'Serbia' },
    { code: 'sc', name: 'Seychelles' },
    { code: 'sl', name: 'Sierra Leone' },
    { code: 'sg', name: 'Singapore' },
    { code: 'sx', name: 'Sint Maarten' },
    { code: 'sk', name: 'Slovakia' },
    { code: 'si', name: 'Slovenia' },
    { code: 'sb', name: 'Solomon Islands' },
    { code: 'so', name: 'Somalia' },
    { code: 'za', name: 'South Africa' },
    { code: 'gs', name: 'South Georgia and the South Sandwich Islands' },
    { code: 'ss', name: 'South Sudan' },
    { code: 'es', name: 'Spain' },
    { code: 'lk', name: 'Sri Lanka' },
    { code: 'sd', name: 'Sudan' },
    { code: 'sr', name: 'Suriname' },
    { code: 'sj', name: 'Svalbard and Jan Mayen' },
    { code: 'sz', name: 'Swaziland' },
    { code: 'se', name: 'Sweden' },
    { code: 'ch', name: 'Switzerland' },
    { code: 'sy', name: 'Syria' },
    { code: 'tw', name: 'Taiwan' },
    { code: 'tj', name: 'Tajikistan' },
    { code: 'tz', name: 'Tanzania' },
    { code: 'th', name: 'Thailand' },
    { code: 'tl', name: 'Timor-Leste' },
    { code: 'tg', name: 'Togo' },
    { code: 'tk', name: 'Tokelau' },
    { code: 'to', name: 'Tonga' },
    { code: 'tt', name: 'Trinidad and Tobago' },
    { code: 'tn', name: 'Tunisia' },
    { code: 'tr', name: 'Turkey' },
    { code: 'tm', name: 'Turkmenistan' },
    { code: 'tc', name: 'Turks and Caicos Islands' },
    { code: 'tv', name: 'Tuvalu' },
    { code: 'vi', name: 'U.S. Virgin Islands' },
    { code: 'ug', name: 'Uganda' },
    { code: 'ua', name: 'Ukraine' },
    { code: 'ae', name: 'United Arab Emirates' },
    { code: 'gb', name: 'United Kingdom' },
    { code: 'us', name: 'United States of America' },
    { code: 'um', name: 'United States Minor Outlying Islands' },
    { code: 'uy', name: 'Uruguay' },
    { code: 'uz', name: 'Uzbekistan' },
    { code: 'vu', name: 'Vanuatu' },
    { code: 've', name: 'Venezuela' },
    { code: 'vn', name: 'Vietnam' },
    { code: 'wf', name: 'Wallis and Futuna' },
    { code: 'eh', name: 'Western Sahara' },
    { code: 'ye', name: 'Yemen' },
    { code: 'zm', name: 'Zambia' },
    { code: 'zw', name: 'Zimbabwe' }
  ]
  const universities = {}
  const universitiesByDomain = {}

  const defaultRoleHints = [
    'Undergraduate Student',
    'Masters Student (MSc, MA, ...)',
    'Doctoral Student (PhD, EngD, ...)',
    'Postdoc',
    'Lecturer',
    'Senior Lecturer',
    'Reader',
    'Associate Professor ',
    'Assistant Professor ',
    'Professor',
    'Emeritus Professor'
  ]
  const defaultDepartmentHints = [
    'Aeronautics & Astronautics',
    'Anesthesia',
    'Anthropology',
    'Applied Physics',
    'Art & Art History',
    'Biochemistry',
    'Bioengineering',
    'Biology',
    'Business School Library',
    'Business, Graduate School of',
    'Cardiothoracic Surgery',
    'Chemical and Systems Biology',
    'Chemical Engineering',
    'Chemistry',
    'Civil & Environmental Engineering',
    'Classics',
    'Communication',
    'Comparative Literature',
    'Comparative Medicine',
    'Computer Science',
    'Dermatology',
    'Developmental Biology',
    'Earth System Science',
    'East Asian Languages and Cultures',
    'Economics',
    'Education, School of',
    'Electrical Engineering',
    'Energy Resources Engineering',
    'English',
    'French and Italian',
    'Genetics',
    'Geological Sciences',
    'Geophysics',
    'German Studies',
    'Health Research & Policy',
    'History',
    'Iberian & Latin American Cultures',
    'Law Library',
    'Law School',
    'Linguistics',
    'Management Science & Engineering',
    'Materials Science & Engineering',
    'Mathematics',
    'Mechanical Engineering',
    'Medical Library',
    'Medicine',
    'Microbiology & Immunology',
    'Molecular & Cellular Physiology',
    'Music',
    'Neurobiology',
    'Neurology & Neurological Sciences',
    'Neurosurgery',
    'Obstetrics and Gynecology',
    'Ophthalmology',
    'Orthopaedic Surgery',
    'Otolaryngology (Head and Neck Surgery)',
    'Pathology',
    'Pediatrics',
    'Philosophy',
    'Physics',
    'Political Science',
    'Psychiatry and Behavioral Sciences',
    'Psychology',
    'Radiation Oncology',
    'Radiology',
    'Religious Studies',
    'Slavic Languages and Literature',
    'Sociology',
    'University Libraries',
    'Statistics',
    'Structural Biology',
    'Surgery',
    'Theater and Performance Studies',
    'Urology'
  ]

  const domainsBlackList = { 'overleaf.com': true }
  const commonTLDs = [
    'br',
    'cn',
    'co',
    'co.jp',
    'co.uk',
    'com',
    'com.au',
    'de',
    'fr',
    'in',
    'info',
    'io',
    'net',
    'no',
    'ru',
    'se',
    'us',
    'com.tw',
    'com.br',
    'pl',
    'it',
    'co.in',
    'com.mx'
  ]
  const commonDomains = [
    'gmail',
    'googlemail',
    'icloud',
    'me',
    'yahoo',
    'ymail',
    'yahoomail',
    'hotmail',
    'live',
    'msn',
    'outlook',
    'gmx',
    'mail',
    'aol',
    '163',
    'mac',
    'qq',
    'o2',
    'libero',
    '126'
  ]

  for (let domain of Array.from(commonDomains)) {
    for (let tld of Array.from(commonTLDs)) {
      domainsBlackList[`${domain}.${tld}`] = true
    }
  }

  return App.factory('UserAffiliationsDataService', function($http, $q, _) {
    const getCountries = () => $q.resolve(countriesList)

    const getDefaultRoleHints = () => $q.resolve(defaultRoleHints)

    const getDefaultDepartmentHints = () => $q.resolve(defaultDepartmentHints)

    const getUserEmails = () =>
      $http.get('/user/emails').then(response => response.data)

    const getUserDefaultEmail = () =>
      getUserEmails().then(userEmails =>
        _.find(userEmails, userEmail => userEmail.default)
      )

    const getUniversitiesFromCountry = function(country) {
      let universitiesFromCountry
      if (universities[country.code] != null) {
        universitiesFromCountry = universities[country.code]
      } else {
        universitiesFromCountry = $http
          .get('/institutions/list', {
            params: { country_code: country.code }
          })
          .then(response => (universities[country.code] = response.data))
      }
      return $q.resolve(universitiesFromCountry)
    }

    const getUniversityDomainFromPartialDomainInput = function(
      partialDomainInput
    ) {
      if (universitiesByDomain[partialDomainInput] != null) {
        return $q.resolve(universitiesByDomain[partialDomainInput])
      } else {
        return $http
          .get('/institutions/domains', {
            params: { hostname: partialDomainInput, limit: 1 }
          })
          .then(function(response) {
            const university = response.data[0]
            if (
              university != null &&
              !isDomainBlacklisted(university.hostname)
            ) {
              universitiesByDomain[university.hostname] = university
              return $q.resolve(university)
            } else {
              return $q.reject(null)
            }
          })
      }
    }

    const getUniversityDetails = universityId =>
      $http
        .get(`/institutions/list/${universityId}`)
        .then(response => response.data)

    const addUserEmail = email =>
      $http.post('/user/emails', {
        email,
        _csrf: window.csrfToken
      })

    const addUserAffiliationWithUnknownUniversity = (
      email,
      unknownUniversityName,
      unknownUniversityCountryCode,
      role,
      department
    ) =>
      $http.post('/user/emails', {
        email,
        university: {
          name: unknownUniversityName,
          country_code: unknownUniversityCountryCode
        },
        role,
        department,
        _csrf: window.csrfToken
      })

    const addUserAffiliation = (email, universityId, role, department) =>
      $http.post('/user/emails', {
        email,
        university: {
          id: universityId
        },
        role,
        department,
        _csrf: window.csrfToken
      })

    const addRoleAndDepartment = (email, role, department) =>
      $http.post('/user/emails/endorse', {
        email,
        role,
        department,
        _csrf: window.csrfToken
      })

    const setDefaultUserEmail = email =>
      $http.post('/user/emails/default', {
        email,
        _csrf: window.csrfToken
      })

    const removeUserEmail = email =>
      $http.post('/user/emails/delete', {
        email,
        _csrf: window.csrfToken
      })

    const resendConfirmationEmail = email =>
      $http.post('/user/emails/resend_confirmation', {
        email,
        _csrf: window.csrfToken
      })

    var isDomainBlacklisted = domain => domain.toLowerCase() in domainsBlackList

    return {
      getCountries,
      getDefaultRoleHints,
      getDefaultDepartmentHints,
      getUserEmails,
      getUserDefaultEmail,
      getUniversitiesFromCountry,
      getUniversityDomainFromPartialDomainInput,
      getUniversityDetails,
      addUserEmail,
      addUserAffiliationWithUnknownUniversity,
      addUserAffiliation,
      addRoleAndDepartment,
      setDefaultUserEmail,
      removeUserEmail,
      resendConfirmationEmail,
      isDomainBlacklisted
    }
  })
})
