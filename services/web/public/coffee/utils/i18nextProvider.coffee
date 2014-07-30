define [

], () ->


	console.log "hello", angular.module('jm.i18next')
	angular.module('jm.i18next').config  ($i18nextProvider)->
		console.log "hello 222"
		$i18nextProvider.options = {
			lng: 'en-GB',
			useCookie: false,
			useLocalStorage: false,
			fallbackLng: 'dev',
			resGetPath: '../locales/__lng__/__ns__.json',
			defaultLoadingValue: '' # ng-i18next option, *NOT* directly supported by i18next
		}
		console.log "SUP"
		console.log $i18nextProvider


