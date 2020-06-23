metrics = require "metrics-sharelatex"
logger = require("logger-sharelatex")

os = require "os"
HOST = os.hostname()
PID = process.pid
COUNT = 0

CHANNEL_MANAGER = {} # hash of event checkers by channel name
CHANNEL_ERROR = {} # error status by channel name

module.exports = class HealthCheckManager
    # create an instance of this class which checks that an event with a unique
    # id is received only once within a timeout
    constructor: (@channel, timeout = 1000) ->
        # unique event string
        @id = "host=#{HOST}:pid=#{PID}:count=#{COUNT++}"
        # count of number of times the event is received
        @count = 0 
        # after a timeout check the status of the count
        @handler = setTimeout () =>
            @setStatus()
        , timeout
        # use a timer to record the latency of the channel
        @timer = new metrics.Timer("event.#{@channel}.latency")
        # keep a record of these objects to dispatch on
        CHANNEL_MANAGER[@channel] = @
    processEvent: (id) ->
        # if this is our event record it
        if id == @id
            @count++
            @timer?.done()
            @timer = null # only time the latency of the first event
    setStatus: () ->
        # if we saw the event anything other than a single time that is an error
        if @count != 1
            logger.err channel:@channel, count:@count, id:@id, "redis channel health check error"
        error = (@count != 1)
        CHANNEL_ERROR[@channel] = error

    # class methods
    @check: (channel, id) ->
        # dispatch event to manager for channel
        CHANNEL_MANAGER[channel]?.processEvent id
    @status: () ->
        # return status of all channels for logging
        return CHANNEL_ERROR
    @isFailing: () -> 
        # check if any channel status is bad 
        for channel, error of CHANNEL_ERROR
            return true if error is true
        return false
