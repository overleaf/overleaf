version = {
	"pdfjs": "1.6.210p1"
	"moment": "2.9.0"
	"ace": "1.2.5"
}

module.exports = {
	version: version

	lib: (name) ->
		if version[name]?
			return "#{name}-#{version[name]}"
		else
			return "#{name}"
}
