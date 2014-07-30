angular.module('jm.i18next').config ['$i18nextProvider', ($i18nextProvider)->
	console.log("hello")
	$i18nextProvider.options =
		lng: 'en-GB',
		useCookie: false,
		useLocalStorage: false,
		fallbackLng: 'en',
		resGetPath: '/locales/__lng__.json'
]