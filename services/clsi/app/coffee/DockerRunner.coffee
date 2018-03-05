Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
Docker = require("dockerode")
dockerode = new Docker()
crypto = require "crypto"
async = require "async"
LockManager = require "./DockerLockManager"
fs = require "fs"
Path = require 'path'
_ = require "underscore"

logger.info "using docker runner"

usingSiblingContainers = () ->
	Settings?.path?.sandboxedCompilesHostDir?

module.exports = DockerRunner =
	ERR_NOT_DIRECTORY: new Error("not a directory")
	ERR_TERMINATED: new Error("terminated")
	ERR_EXITED: new Error("exited")
	ERR_TIMED_OUT: new Error("container timed out")

	run: (project_id, command, directory, image, timeout, environment, callback = (error, output) ->) ->

		if usingSiblingContainers()
			_newPath = Settings.path.sandboxedCompilesHostDir
			logger.log {path: _newPath}, "altering bind path for sibling containers"
			# Server Pro, example:
			#   '/var/lib/sharelatex/data/compiles/<project-id>'
			#   ... becomes ...
			#   '/opt/sharelatex_data/data/compiles/<project-id>'
			directory = Path.join(Settings.path.sandboxedCompilesHostDir, Path.basename(directory))

		volumes = {}
		volumes[directory] = "/compile"

		command = (arg.toString().replace?('$COMPILE_DIR', "/compile") for arg in command)
		if !image?
			image = Settings.clsi.docker.image

		options      = DockerRunner._getContainerOptions(command, image, volumes, timeout, environment)
		fingerprint  = DockerRunner._fingerprintContainer(options)
		options.name = name = "project-#{project_id}-#{fingerprint}"

		logger.log project_id: project_id, options: options, "running docker container"
		DockerRunner._runAndWaitForContainer options, volumes, timeout, (error, output) ->
			if error?.message?.match("HTTP code is 500")
				logger.log err: error, project_id: project_id, "error running container so destroying and retrying"
				DockerRunner.destroyContainer name, null, true, (error) ->
					return callback(error) if error?
					DockerRunner._runAndWaitForContainer options, volumes, timeout, callback
			else
				callback(error, output)

		return name # pass back the container name to allow it to be killed

	kill: (container_id, callback = (error) ->) ->
		logger.log container_id: container_id, "sending kill signal to container"
		container = dockerode.getContainer(container_id)
		container.kill (error) ->
			if error? and error?.message?.match?(/Cannot kill container .* is not running/)
				logger.warn err: error, container_id: container_id, "container not running, continuing"
				error = null
			if error?
				logger.error err: error, container_id: container_id, "error killing container"
				return callback(error)
			else
				callback()

	_runAndWaitForContainer: (options, volumes, timeout, _callback = (error, output) ->) ->
		callback = (args...) ->
			_callback(args...)
			# Only call the callback once
			_callback = () ->
		
		name = options.name

		streamEnded = false
		containerReturned = false
		output = {}

		callbackIfFinished = () ->
			if streamEnded and containerReturned
				callback(null, output)

		attachStreamHandler = (error, _output) ->
			return callback(error) if error?
			output = _output
			streamEnded = true
			callbackIfFinished()

		DockerRunner.startContainer options, volumes, attachStreamHandler, (error, containerId) ->
			return callback(error) if error?
			
			DockerRunner.waitForContainer name, timeout, (error, exitCode) ->
				return callback(error) if error?
				if exitCode is 137  # exit status from kill -9
					err = DockerRunner.ERR_TERMINATED
					err.terminated = true
					return callback(err)
				if exitCode is 1 # exit status from chktex
					err = DockerRunner.ERR_EXITED
					err.code = exitCode
					return callback(err)
				containerReturned = true
				callbackIfFinished()

	_getContainerOptions: (command, image, volumes, timeout, environment) ->
		timeoutInSeconds = timeout / 1000
		
		if Settings.path?.synctexBinHostPath?
			volumes[Settings.path.synctexBinHostPath] = "/opt/synctex:ro"

		dockerVolumes = {}
		for hostVol, dockerVol of volumes
			dockerVolumes[dockerVol] = {}

			if volumes[hostVol].slice(-3).indexOf(":r") == -1
				volumes[hostVol] = "#{dockerVol}:rw"


		# merge settings and environment parameter
		env = {}
		for src in [Settings.clsi.docker.env, environment or {}]
			env[key] = value for key, value of src
		# set the path based on the image year
		if m = image.match /:([0-9]+)\.[0-9]+/
			year = m[1]
		else
			year = "2014"
		env['PATH'] = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/texlive/#{year}/bin/x86_64-linux/"
		options =
			"Cmd"             : command,
			"Image"           : image
			"Volumes"         : dockerVolumes
			"WorkingDir"      : "/compile"
			"NetworkDisabled" : true
			"Memory"          : 1024 * 1024 * 1024 * 1024 # 1 Gb
			"User"            : Settings.clsi.docker.user
			"Env"             : ("#{key}=#{value}" for key, value of env)	# convert the environment hash to an array
			"HostConfig"      :
				"Binds": ("#{hostVol}:#{dockerVol}" for hostVol, dockerVol of volumes)
				"LogConfig": {"Type": "none", "Config": {}}
				"Ulimits": [{'Name': 'cpu', 'Soft': timeoutInSeconds+5, 'Hard': timeoutInSeconds+10}]
				"CapDrop": "ALL"
				"SecurityOpt": ["no-new-privileges"]
		if Settings.clsi.docker.seccomp_profile?
			options.HostConfig.SecurityOpt.push "seccomp=#{Settings.clsi.docker.seccomp_profile}"
		return options

	_fingerprintContainer: (containerOptions) ->
		# Yay, Hashing!
		json = JSON.stringify(containerOptions)
		return crypto.createHash("md5").update(json).digest("hex")

	startContainer: (options, volumes, attachStreamHandler, callback) ->
		LockManager.runWithLock options.name, (releaseLock) ->
			# Check that volumes exist before starting the container.
			# When a container is started with volume pointing to a
			# non-existent directory then docker creates the directory but
			# with root ownership.
			DockerRunner._checkVolumes options, volumes, (err) ->
				return releaseLock(err) if err?
				DockerRunner._startContainer options, volumes, attachStreamHandler, releaseLock
		, callback

	# Check that volumes exist and are directories
	_checkVolumes: (options, volumes, callback = (error, containerName) ->) ->
		if usingSiblingContainers()
			# Server Pro, with sibling-containers active, skip checks
			return callback(null)

		checkVolume = (path, cb) ->
			fs.stat path, (err, stats) ->
				return cb(err) if err?
				return cb(DockerRunner.ERR_NOT_DIRECTORY) if not stats?.isDirectory()
				cb()
		jobs = []
		for vol of volumes
			do (vol) ->
				jobs.push (cb) -> checkVolume(vol, cb)
		async.series jobs, callback

	_startContainer: (options, volumes, attachStreamHandler, callback = ((error, output) ->)) ->
		callback = _.once(callback)
		name = options.name

		logger.log {container_name: name}, "starting container"
		container = dockerode.getContainer(name)

		createAndStartContainer = ->
			dockerode.createContainer options, (error, container) ->
				return callback(error) if error?
				startExistingContainer()

		startExistingContainer = ->
			DockerRunner.attachToContainer options.name, attachStreamHandler, (error)->
				return callback(error) if error?
				container.start (error) ->
					if error? and error?.statusCode != 304 #already running
						return callback(error)
					else
						callback()

		container.inspect (error, stats)->
			if error?.statusCode == 404
				createAndStartContainer()
			else if error?
				logger.err {container_name: name}, "unable to inspect container to start"
				return callback(error)
			else
				startExistingContainer()


	attachToContainer: (containerId, attachStreamHandler, attachStartCallback) ->
		container = dockerode.getContainer(containerId)
		container.attach {stdout: 1, stderr: 1, stream: 1}, (error, stream) ->
			if error?
				logger.error err: error, container_id: containerId, "error attaching to container"
				return attachStartCallback(error)
			else
				attachStartCallback()


			logger.log container_id: containerId, "attached to container"

			MAX_OUTPUT = 1024 * 1024 # limit output to 1MB
			createStringOutputStream = (name) ->
				return {
					data: ""
					overflowed: false
					write: (data) ->
						return if @overflowed
						if @data.length < MAX_OUTPUT
							@data += data
						else
							logger.error container_id: containerId, length: @data.length, maxLen: MAX_OUTPUT, "#{name} exceeds max size"
							@data += "(...truncated at #{MAX_OUTPUT} chars...)"
							@overflowed = true
							# kill container if too much output
							# docker.containers.kill(containerId, () ->)
				}

			stdout = createStringOutputStream "stdout"
			stderr = createStringOutputStream "stderr"

			container.modem.demuxStream(stream, stdout, stderr)

			stream.on "error", (err) ->
				logger.error err: err, container_id: containerId, "error reading from container stream"

			stream.on "end", () ->
				attachStreamHandler null, {stdout: stdout.data, stderr: stderr.data}

	waitForContainer: (containerId, timeout, _callback = (error, exitCode) ->) ->
		callback = (args...) ->
			_callback(args...)
			# Only call the callback once
			_callback = () ->

		container = dockerode.getContainer(containerId)

		timedOut = false
		timeoutId = setTimeout () ->
			timedOut = true
			logger.log container_id: containerId, "timeout reached, killing container"
			container.kill(() ->)
		, timeout
			
		logger.log container_id: containerId, "waiting for docker container"
		container.wait (error, res) ->
			if error?
				clearTimeout timeoutId
				logger.error err: error, container_id: containerId, "error waiting for container"
				return callback(error)
			if timedOut
				logger.log containerId: containerId, "docker container timed out"
				error = DockerRunner.ERR_TIMED_OUT
				error.timedout = true
				callback error
			else
				clearTimeout timeoutId
				logger.log container_id: containerId, exitCode: res.StatusCode, "docker container returned"
				callback null, res.StatusCode

	destroyContainer: (containerName, containerId, shouldForce, callback = (error) ->) ->
		# We want the containerName for the lock and, ideally, the
		# containerId to delete.  There is a bug in the docker.io module
		# where if you delete by name and there is an error, it throws an
		# async exception, but if you delete by id it just does a normal
		# error callback. We fall back to deleting by name if no id is
		# supplied.
		LockManager.runWithLock containerName, (releaseLock) ->
			DockerRunner._destroyContainer containerId or containerName, shouldForce, releaseLock
		, callback

	_destroyContainer: (containerId, shouldForce, callback = (error) ->) ->
		logger.log container_id: containerId, "destroying docker container"
		container = dockerode.getContainer(containerId)
		container.remove {force: shouldForce == true}, (error) ->
			if error? and error?.statusCode == 404
				logger.warn err: error, container_id: containerId, "container not found, continuing"
				error = null
			if error?
				logger.error err: error, container_id: containerId, "error destroying container"
			else
				logger.log container_id: containerId, "destroyed container"
			callback(error)

	# handle expiry of docker containers

	MAX_CONTAINER_AGE: Settings.clsi.docker.maxContainerAge or oneHour = 60 * 60 * 1000

	examineOldContainer: (container, callback = (error, name, id, ttl)->) ->
		name = container.Name or container.Names?[0]
		created = container.Created * 1000 # creation time is returned in seconds
		now = Date.now()
		age = now - created
		maxAge = DockerRunner.MAX_CONTAINER_AGE
		ttl = maxAge - age
		logger.log {containerName: name, created: created, now: now, age: age, maxAge: maxAge, ttl: ttl}, "checking whether to destroy container"
		callback(null, name, container.Id, ttl)

	destroyOldContainers: (callback = (error) ->) ->
		dockerode.listContainers all: true, (error, containers) ->
			return callback(error) if error?
			jobs = []
			for container in containers or []
				do (container) ->
					DockerRunner.examineOldContainer container, (err, name, id, ttl) ->
						if name.slice(0, 9) == '/project-' && ttl <= 0
							jobs.push	(cb) ->
								DockerRunner.destroyContainer name, id, false, () -> cb()
								# Ignore errors because some containers get stuck but
								# will be destroyed next time
			async.series jobs, callback

	startContainerMonitor: () ->
		logger.log {maxAge: DockerRunner.MAX_CONTAINER_AGE}, "starting container expiry"
		# randomise the start time
		randomDelay = Math.floor(Math.random() * 5 * 60 * 1000)
		setTimeout () ->
			setInterval () ->
				DockerRunner.destroyOldContainers()
			, oneHour = 60 * 60 * 1000
		, randomDelay

DockerRunner.startContainerMonitor()