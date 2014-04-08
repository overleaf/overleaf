request = require "request"
fs = require "fs"
Settings = require "settings-sharelatex"

host = "localhost"

module.exports = Client =
	host: Settings.apis.clsi.url

	randomId: () ->
		Math.random().toString(16).slice(2)

	compile: (project_id, data, callback = (error, res, body) ->) ->
		request.post {
			url: "#{@host}/project/#{project_id}/compile"
			json:
				compile: data
		}, callback

	clearCache: (project_id, callback = (error, res, body) ->) ->
		request.del "#{@host}/project/#{project_id}", callback

	getOutputFile: (response, type) ->
		for file in response.compile.outputFiles
			if file.type == type and file.url.match("output.#{type}")
				return file
		return null

	runServer: (port, directory) ->
		express = require("express")
		app = express()
		app.use express.static(directory)
		app.listen(port, host)

	syncFromCode: (project_id, file, line, column, callback = (error, pdfPositions) ->) ->
		request.get {
			url: "#{@host}/project/#{project_id}/sync/code"
			qs: {
				file: file
				line: line
				column: column
			}
		}, (error, response, body) ->
			return callback(error) if error?
			callback null, JSON.parse(body)

	syncFromPdf: (project_id, page, h, v, callback = (error, pdfPositions) ->) ->
		request.get {
			url: "#{@host}/project/#{project_id}/sync/pdf"
			qs: {
				page: page,
				h: h, v: v
			}
		}, (error, response, body) ->
			return callback(error) if error?
			callback null, JSON.parse(body)

	compileDirectory: (project_id, baseDirectory, directory, serverPort, callback = (error, res, body) ->) ->
		resources = []
		entities = fs.readdirSync("#{baseDirectory}/#{directory}")
		rootResourcePath = "main.tex"
		while (entities.length > 0)
			entity = entities.pop()
			stat = fs.statSync("#{baseDirectory}/#{directory}/#{entity}")
			if stat.isDirectory()
				entities = entities.concat fs.readdirSync("#{baseDirectory}/#{directory}/#{entity}").map (subEntity) ->
					if subEntity == "main.tex"
						rootResourcePath = "#{entity}/#{subEntity}"
					return "#{entity}/#{subEntity}"
			else if stat.isFile() and entity != "output.pdf"
				extension = entity.split(".").pop()
				if ["tex", "bib", "cls", "sty", "pdf_tex", "Rtex", "ist", "md", "Rmd"].indexOf(extension) > -1
					resources.push
						path: entity
						content: fs.readFileSync("#{baseDirectory}/#{directory}/#{entity}").toString()
				else if ["eps", "ttf", "png", "jpg", "pdf", "jpeg"].indexOf(extension) > -1
					resources.push
						path: entity
						url: "http://#{host}:#{serverPort}/#{directory}/#{entity}"
						modified: stat.mtime

		fs.readFile "#{baseDirectory}/#{directory}/options.json", (error, body) =>
			req =
				resources: resources
				rootResourcePath: rootResourcePath

			if !error?
				body = JSON.parse body
				req.options = body

			@compile project_id, req, callback

