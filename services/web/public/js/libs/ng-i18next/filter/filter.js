angular.module('jm.i18next').filter('i18next', ['$i18next', function ($i18next) {

	'use strict';

	console.log("running filter")
	return function (string, options) {

		return $i18next(string, options);

	};

}]);
