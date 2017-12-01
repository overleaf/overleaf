version = {
	"pdfjs": "1.7.225"
	"moment": "2.9.0"
	"ace": "1.2.5"
	"fineuploader": "5.15.4"
}

module.exports = {
	version: version

	lib: (name) ->
		if version[name]?
			return "#{name}-#{version[name]}"
		else
			return "#{name}"
}
