define [
	"libs"
], () ->
	angular.module('underscore', []).factory '_', ->
		return window._
