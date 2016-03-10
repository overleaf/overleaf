Path = require 'path'

# here we coerce html, css and js to text/plain,
# otherwise choose correct mime type based on file extension,
# falling back to octet-stream
module.exports = ContentTypeMapper =
	map: (path) ->
		switch Path.extname(path)
			when '.txt', '.html', '.js', '.css', '.svg'
				return 'text/plain'
			when '.csv'
				return 'text/csv'
			when '.pdf'
				return 'application/pdf'
			when '.png'
				return 'image/png'
			when '.jpg', '.jpeg'
				return 'image/jpeg'
			when '.tiff'
				return 'image/tiff'
			when '.gif'
				return 'image/gif'
			else
				return 'application/octet-stream'
