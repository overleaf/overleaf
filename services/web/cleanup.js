var keys = require('./app/js/infrastructure/Keys');
var settings = require('settings-sharelatex');
var queueName = process.argv[2];
var projectQueueName = process.argv[3];
var queue = require('fairy').connect(settings.redis.web).queue(queueName);
console.log("cleaning up queue "+ queueName + " " + projectQueueName);
queue._requeue_group(projectQueueName);

//fairy should kill the process but just in case
thirtySeconds = 30 * 1000
setTimeout(process.exit, thirtySeconds)
