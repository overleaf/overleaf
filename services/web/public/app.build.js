({
	appDir: "js",
	baseUrl: "./",
	dir: "minjs",
	inlineText:false,
	preserveLicenseComments:false,

	paths : {
		"underscore": "libs/underscore",
		"jquery": "libs/jquery"
	},
	shim: {
		"libs/backbone": {
			deps: ["libs/underscore"]
		},
		"libs/pdfListView/PdfListView": {
			deps: ["libs/pdf"]
		},
		"libs/pdf": {
			deps: ["libs/compatibility"]
		}
	},

	skipDirOptimize: true,

	modules: [
		{
			name: "main",
			exclude: ["jquery"]
		}, {
			name: "ide",
			exclude: ["jquery"]
		}, {
			name: "home",
			exclude: ["jquery"]
		}, {
			name: "list",
			exclude: ["jquery"]
		}
	]
})
