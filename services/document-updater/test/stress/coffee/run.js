DocUpdaterClient = require "../../acceptance/coffee/helpers/DocUpdaterClient"
# MockTrackChangesApi = require "../../acceptance/js/helpers/MockTrackChangesApi"
# MockWebApi = require "../../acceptance/js/helpers/MockWebApi"
assert = require "assert"
async = require "async"

insert = (string, pos, content) ->
	result = string.slice(0, pos) + content + string.slice(pos)
	return result

transform = (op1, op2) ->
	if op2.p < op1.p
		return {
			p: op1.p + op2.i.length
			i: op1.i
		}
	else
		return op1

class StressTestClient
	constructor: (@options = {}) ->
		@options.updateDelay ?= 200
		@project_id = @options.project_id or DocUpdaterClient.randomId()
		@doc_id = @options.doc_id or DocUpdaterClient.randomId()
		@pos = @options.pos or 0
		@content = @options.content or ""

		@client_id = DocUpdaterClient.randomId()
		@version = @options.version or 0
		@inflight_op = null
		@charCode = 0
		
		@counts = {
			conflicts: 0
			local_updates: 0
			remote_updates: 0
			max_delay: 0
		}
		
		DocUpdaterClient.subscribeToAppliedOps (channel, update) =>
			update = JSON.parse(update)
			if update.error?
				console.error new Error("Error from server: '#{update.error}'")
				return
			if update.doc_id == @doc_id
				@processReply(update)
	
	sendUpdate: () ->
		data = String.fromCharCode(65 + @charCode++ % 26)
		@content = insert(@content, @pos, data)
		@inflight_op = {
			i: data
			p: @pos++
		}
		@resendUpdate()
		@inflight_op_sent = Date.now()
	
	resendUpdate: () ->
		assert(@inflight_op?)
		DocUpdaterClient.sendUpdate(
			@project_id, @doc_id
			{
				doc: @doc_id
				op: [@inflight_op]
				v: @version
				meta:
					source: @client_id
				dupIfSource: [@client_id]
			}
		)
		@update_timer = setTimeout () =>
			console.log "[#{new Date()}] \t[#{@client_id.slice(0,4)}] WARN: Resending update after 5 seconds"
			@resendUpdate()
		, 5000
	
	processReply: (update) ->
		if update.op.v != @version
			if update.op.v < @version
				console.log "[#{new Date()}] \t[#{@client_id.slice(0,4)}] WARN: Duplicate ack (already seen version)"
				return
			else
				console.error "[#{new Date()}] \t[#{@client_id.slice(0,4)}] ERROR: Version jumped ahead (client: #{@version}, op: #{update.op.v})"
		@version++
		if update.op.meta.source == @client_id
			if @inflight_op?
				@counts.local_updates++
				@inflight_op = null
				clearTimeout @update_timer
				delay = Date.now() - @inflight_op_sent
				@counts.max_delay = Math.max(@counts.max_delay, delay)
				@continue()
			else
				console.log "[#{new Date()}] \t[#{@client_id.slice(0,4)}] WARN: Duplicate ack"
		else
			assert(update.op.op.length == 1)
			@counts.remote_updates++
			external_op = update.op.op[0]
			if @inflight_op?
				@counts.conflicts++
				@inflight_op = transform(@inflight_op, external_op)
				external_op = transform(external_op, @inflight_op)
			if external_op.p < @pos
				@pos += external_op.i.length
			@content = insert(@content, external_op.p, external_op.i)
	
	continue: () ->
		if @updateCount > 0
			@updateCount--
			setTimeout () =>
				@sendUpdate()
			, @options.updateDelay * ( 0.5 + Math.random() )
		else
			@updateCallback()
	
	runForNUpdates: (n, callback = (error) ->) ->
		@updateCallback = callback
		@updateCount = n
		@continue()
	
	check: (callback = (error) ->) ->
		DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, body) =>
			throw error if error?
			if !body.lines?
				return console.error "[#{new Date()}] \t[#{@client_id.slice(0,4)}] ERROR: Invalid response from get doc (#{doc_id})", body
			content = body.lines.join("\n")
			version = body.version
			if content != @content
				if version == @version
					console.error "[#{new Date()}] \t[#{@client_id.slice(0,4)}] Error: Client content does not match server."
					console.error "Server: #{content.split('a')}"
					console.error "Client: #{@content.split('a')}"
				else
					console.error "[#{new Date()}] \t[#{@client_id.slice(0,4)}] Error: Version mismatch (Server: '#{version}', Client: '#{@version}')"

			if !@isContentValid(@content)
				for chunk, i in @content.split("")
					if chunk? and chunk != "a"
						console.log chunk, i
				throw new Error("bad content")
			callback()

	isChunkValid: (chunk) ->
		char = 0
		for letter, i in chunk
			if letter.charCodeAt(0) != 65 + i % 26
				console.error "[#{new Date()}] \t[#{@client_id.slice(0,4)}] Invalid Chunk:", chunk
				return false
		return true

	isContentValid: (content) ->
		for chunk in content.split('a')
			if chunk? and chunk != ""
				if !@isChunkValid(chunk)
					
					console.error "[#{new Date()}] \t[#{@client_id.slice(0,4)}] Invalid content", content
					return false
		return true


checkDocument = (project_id, doc_id, clients, callback = (error) ->) ->
	jobs = clients.map (client) ->
		(cb) -> client.check cb
	async.parallel jobs, callback

printSummary = (doc_id, clients) ->
	slot = require('cluster-key-slot')
	now = new Date()
	console.log "[#{now}] [#{doc_id.slice(0,4)} (slot: #{slot(doc_id)})] #{clients.length} clients..."
	for client in clients
		console.log "[#{now}] \t[#{client.client_id.slice(0,4)}] { local: #{client.counts.local_updates }, remote: #{client.counts.remote_updates}, conflicts: #{client.counts.conflicts}, max_delay: #{client.counts.max_delay} }"
		client.counts = {
			local_updates: 0
			remote_updates: 0
			conflicts: 0
			max_delay: 0
		}

CLIENT_COUNT = parseInt(process.argv[2], 10)
UPDATE_DELAY = parseInt(process.argv[3], 10)
SAMPLE_INTERVAL = parseInt(process.argv[4], 10)

for doc_and_project_id in process.argv.slice(5)
	do (doc_and_project_id) ->
		[project_id, doc_id] = doc_and_project_id.split(":")
		console.log {project_id, doc_id}
		DocUpdaterClient.setDocLines project_id, doc_id, [(new Array(CLIENT_COUNT + 2)).join('a')], null, null, (error) ->
			throw error if error?
			DocUpdaterClient.getDoc project_id, doc_id, (error, res, body) =>
				throw error if error?
				if !body.lines?
					return console.error "[#{new Date()}] ERROR: Invalid response from get doc (#{doc_id})", body
				content = body.lines.join("\n")
				version = body.version
			
				clients = []
				for pos in [1..CLIENT_COUNT]
					do (pos) ->
						client = new StressTestClient({doc_id, project_id, content, pos: pos, version: version, updateDelay: UPDATE_DELAY})
						clients.push client
				
				do runBatch = () ->
					jobs = clients.map (client) ->
						(cb) -> client.runForNUpdates(SAMPLE_INTERVAL / UPDATE_DELAY, cb)
					async.parallel jobs, (error) ->
						throw error if error?
						printSummary(doc_id, clients)
						checkDocument project_id, doc_id, clients, (error) ->
							throw error if error?
							runBatch()
