define [
	"libraries"
], () ->
	angular.module('underscore', []).factory '_', ->
		return window._
