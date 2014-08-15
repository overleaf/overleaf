requirejs.config({
	baseUrl: "./build",
	out: "./build/chat.js",
	inlineText:true,
	preserveLicenseComments:false,
	shim: {
		"libs/underscore": {
			init: function() {
				return _.noConflict();
			}
		},
		"libs/backbone": {
			deps: ["libs/underscore"],
			init: function() {
				return Backbone.noConflict();
			}
		}
	},
	paths: {
		"moment": "libs/moment",
	},
	name:"chat",
	optimize: 'none',
	skipDirOptimize: true
})