DocUpdaterClient = require "../../acceptance/coffee/helpers/DocUpdaterClient"
# MockTrackChangesApi = require "../../acceptance/js/helpers/MockTrackChangesApi"
# MockWebApi = require "../../acceptance/js/helpers/MockWebApi"
assert = require "assert"
async = require "async"

insert = (string, pos, content) ->
	string.slice(0, pos) + content + string.slice(pos)

transform = (op1, op2) ->
	if op2.p < op1.p
		op1.p += op2.i.length
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
			if update.doc_id == @doc_id
				@processReply(update)
	
	sendUpdate: () ->
		data = String.fromCharCode(65 + @charCode++ % 26)
		@content = insert(@content, @pos, data)
		DocUpdaterClient.sendUpdate(
			@project_id, @doc_id
			{
				doc: @doc_id
				op: [@inflight_op = {
					i: data
					p: @pos++
				}]
				v: @version
				meta:
					source: @client_id
			}
		)
		@inflight_op_sent = Date.now()
	
	processReply: (update) ->
		if update.error?
			throw new Error("Error from server: '#{update.error}'")
		assert(update.op.v == @version, "Op version from server is not increasing by 1 each time")
		@version++
		if update.op.meta.source == @client_id
			@counts.local_updates++
			@inflight_op = null
			delay = Date.now() - @inflight_op_sent
			@counts.max_delay = Math.max(@counts.max_delay, delay)
			@continue()
		else
			assert(update.op.op.length == 1)
			@counts.remote_updates++
			external_op = update.op.op[0]
			if @inflight_op?
				@counts.conflicts++
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
				return console.error "[#{new Date()}] ERROR: Invalid response from get doc (#{doc_id})", body
			content = body.lines.join("\n")
			if content != @content
				console.error "[#{new Date()}] Error: Client content does not match server (Server: '#{content}', Client: '#{@content}')"
			# TODO: Check content is of the correct form
			callback()


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

UPDATE_DELAY = parseInt(process.argv[2], 10)
SAMPLE_INTERVAL = parseInt(process.argv[3], 10)

for doc_and_project_id in process.argv.slice(4)
	do (doc_and_project_id) ->
		[project_id, doc_id] = doc_and_project_id.split(":")
		console.log {project_id, doc_id}
		DocUpdaterClient.getDoc project_id, doc_id, (error, res, body) =>
			throw error if error?
			if !body.lines?
				return console.error "[#{new Date()}] ERROR: Invalid response from get doc (#{doc_id})", body
			content = body.lines.join("\n")
			version = body.version
		
			clients = []
			for pos in [1, 2, 3, 4, 5]
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
