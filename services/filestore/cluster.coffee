recluster = require "recluster" # https://github.com/doxout/recluster
path = require "path"

cluster = recluster path.join(__dirname, 'app.js'), {
		workers: 2,
		backoff: 0,
		readyWhen: "listening"
}
cluster.run()
