# N requests in parallel
# send P correct words and Q incorrect words
# generate incorrect words by qq+random

async = require "async"
request = require "request"
fs = require "fs"

# created with
# aspell -d en dump master | aspell -l en expand | shuf -n 150000 > words.txt
WORDS = "words.txt"
wordlist = fs.readFileSync(WORDS).toString().split('\n').filter (w) ->
	w.match(/^[a-z]+$/)

generateCorrectWords = (n) ->
	words = []
	N = if Math.random() > 0.5 then wordlist.length else 10
	for i in [1 .. n]
		j = Math.floor(N * Math.random())
		words.push wordlist[j]
	return words
	
generateIncorrectWords = (n) ->
	words = []
	N = wordlist.length
	for i in [1 .. n]
		j = Math.floor(N * Math.random())
		words.push("qzxq" + wordlist[j])
	return words

make_request = (correctWords, incorrectWords, callback) ->
	correctSet = generateCorrectWords(correctWords)
	incorrectSet = generateIncorrectWords(incorrectWords)
	correctSet.push('constructor')
	incorrectSet.push('qzxqfoofoofoo')
	full = correctSet.concat incorrectSet
	bad = []
	for w, i in correctSet
		bad[i] = false
	for w, i in incorrectSet
		bad[i+correctSet.length] = true
	k = full.length
	full.forEach (e, i) ->
		j = Math.floor(k * Math.random())
		[ full[i], full[j] ] = [ full[j], full[i] ]
		[ bad[i], bad[j] ] = [ bad[j], bad[i] ]
	expected = []
	for tf, i in bad
		if tf
			expected.push {index: i, word: full[i]}
	request.post 'http://localhost:3005/user/1/check', json:true, body: {words: full}, (err, req, body) ->
		misspellings = body.misspellings
		console.log JSON.stringify({full: full, misspellings: misspellings})
		if expected.length != misspellings.length
			console.log "ERROR: length mismatch", expected.length, misspellings.length
			console.log full, bad
			console.log 'expected', expected, 'mispellings', misspellings
			for i in [0 .. Math.max(expected.length, misspellings.length)-1]
				if expected[i].index !=  misspellings[i].index
					console.log "ERROR", i, expected[i], misspellings[i], full[misspellings[i].index]
			for m in misspellings
				console.log full[m.index], "=>", m
			process.exit()
			callback("error")
		else 
			for m,i in body.misspellings
				if m.index != expected[i].index
					console.log "ERROR AT RESULT", i, m, expected[i]
					process.exit()
					callback("error")
		callback(null, full)

q = async.queue	 (task, callback) ->
	setTimeout () ->
		make_request task.correct, task.incorrect, callback
	, Math.random() * 100
, 3

q.drain = () ->
	console.log('all items have been processed');

for i in [0 .. 1000]
	if Math.random() < 0.1
		q.push({correct: Math.floor(10000*Math.random()), incorrect: Math.floor(100*Math.random())})
	else
		q.push({correct: Math.floor(3*Math.random()) + 1, incorrect: Math.floor(3*Math.random())})
