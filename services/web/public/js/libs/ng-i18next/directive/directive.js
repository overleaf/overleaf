angular.module('jm.i18next').directive('ngI18next', ['$rootScope', '$i18next', '$compile', '$parse', '$interpolate', function ($rootScope, $i18next, $compile, $parse, $interpolate) {

	'use strict';

	console.log("running directive")
	var watchUnregister;

	function parse(scope, element, key) {

		var attr = 'text',
			attrs = [attr],
			string,
			i;

		// If there was a watched value, unregister it
		if (watchUnregister) {
			watchUnregister();
		}

		key = key.trim();

		/*
		 * Check if we want to translate an attribute
		 */
		if (key.indexOf('[') === 0) {

			var parts = key.split(']');

			// If there are more than two parts because of multiple "]", concatenate them again.
			if (parts.length > 2) {
				for (i = 2; i < parts.length; i++) {
					parts[1] += ']' + parts[i];
					parts[i] = null;
				}
			}

			key = parts[1];
			attr = parts[0].substr(1, parts[0].length - 1);

		}
		/*
		 * Cut of the ";" that might be at the end of the string
		 */
		if (key.indexOf(';') === key.length - 1) {
			key = key.substr(0, key.length - 2).trim();
		}
		/*
		 * If passing options, split attr
		 */
		if (attr.indexOf(':') >= 0) {
			attrs = attr.split(':');
			attr = attrs[0];
		} else if (attr === 'i18next') {
			attrs[1] = 'i18next';
			attr = 'text';
		}

		if (attr !== 'i18next' && attrs[1] !== 'i18next') {

			string = $i18next(key);

		} else {

			var options = {},
				strippedKey = key;

			if (key.indexOf('(') >= 0 && key.indexOf(')') >= 0) {

				var keys = key.split(')');

				keys[0] = keys[0].substr(1, keys[0].length);

				if (keys.length > 2) {

					strippedKey = keys.pop();

					options = $parse(keys.join(')'))(scope);

				} else {

					options = $parse(keys[0])(scope);
					strippedKey = keys[1].trim();

				}

				if (options.sprintf) {
					options.postProcess = 'sprintf';
				}

			}

			string = $i18next(strippedKey, options);

		}

		if (attr === 'html') {

			element.empty().append(string);

			/*
			 * Now compile the content of the element and bind the variables to
			 * the scope
			 */
			$compile(element.contents())(scope);

		} else {
			var insertText = element.text.bind(element);

			if (attr !== 'text') {
				insertText = element.attr.bind(element, attr);
			}

			watchUnregister = scope.$watch($interpolate(string), insertText);
			insertText(string);
		}

		if (!$rootScope.$$phase) {
			$rootScope.$digest();
		}
	}


	function localize(scope, element, key) {

		if (key.indexOf(';') >= 0) {

			var keys = key.split(';');

			for (var i = 0; i < keys.length; i++) {
				if (keys[i] !== '') {
					parse(scope, element, keys[i]);
				}
			}

		} else {
			parse(scope, element, key);
		}

	}

	return {

		// 'A': only as attribute
		restrict: 'A',

		scope: false,

		link: function postLink(scope, element, attrs) {

			var translationValue;

			function observe(value) {
				translationValue = value.replace(/^\s+|\s+$/g, ''); // RegEx removes whitespace

				if (translationValue === '') {
					return setupWatcher();
				}

				localize(scope, element, translationValue);
			}

			function setupWatcher() {
				// Prevent from executing this method twice
				if (setupWatcher.done) {
					return;
				}

				// interpolate is allowing to transform {{expr}} into text
				var interpolation = $interpolate(element.html());

				scope.$watch(interpolation, observe);

				setupWatcher.done = true;
			}

			attrs.$observe('ngI18next', observe);

			scope.$on('i18nextLanguageChange', function () {
				localize(scope, element, translationValue);
			});
		}

	};

}]);
