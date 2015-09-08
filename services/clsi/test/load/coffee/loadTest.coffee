request = require "request"
Settings = require "settings-sharelatex"
async = require("async")
fs = require("fs")
_ = require("underscore")
concurentCompiles = 5
totalCompiles = 50

buildUrl = (path) -> "http://#{Settings.internal.clsi.host}:#{Settings.internal.clsi.port}/#{path}"

mainTexContent = fs.readFileSync("./bulk.tex", "utf-8")

compileTimes = []
failedCount = 0

getAverageCompileTime = ->
	totalTime = _.reduce compileTimes, (sum, time)->
		sum + time
	, 0
	return totalTime / compileTimes.length

makeRequest = (compileNumber, callback)->
	bulkBodyCount = 7
	bodyContent = ""
	while --bulkBodyCount
		bodyContent = bodyContent+=mainTexContent


	startTime = new Date()
	request.post {
		url: buildUrl("project/loadcompile-#{compileNumber}/compile")
		json:
			compile:
				resources: [
					path: "main.tex"
					content: """
						\\documentclass{article}
						\\begin{document}
						#{bodyContent}
						\\end{document}
					"""
				]
		}, (err, response, body)->
			if response.statusCode != 200
				failedCount++
				return callback("compile #{compileNumber} failed")
			if err?
				failedCount++
				return callback("failed")
			totalTime = new Date() - startTime
			console.log totalTime+"ms"
			compileTimes.push(totalTime)
			callback(err)


jobs = _.map [1..totalCompiles], (i)->
	return (cb)->
		makeRequest(i, cb)

startTime = new Date()
async.parallelLimit jobs, concurentCompiles, (err)->
	if err?
		console.error err
	console.log("total time taken = #{(new Date() - startTime)/1000}s")
	console.log("total compiles = #{totalCompiles}")
	console.log("concurent compiles = #{concurentCompiles}")
	console.log("average time = #{getAverageCompileTime()/1000}s")
	console.log("max time = #{_.max(compileTimes)/1000}s")
	console.log("min time = #{_.min(compileTimes)/1000}s")
	console.log("total failures = #{failedCount}")

