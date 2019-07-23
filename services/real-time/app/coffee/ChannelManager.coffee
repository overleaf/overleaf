logger = require 'logger-sharelatex'
metrics = require "metrics-sharelatex"
settings = require "settings-sharelatex"

ClientMap = new Map() # for each redis client, stores a Map of subscribed channels (channelname -> subscribe promise)

# Manage redis pubsub subscriptions for individual projects and docs, ensuring
# that we never subscribe to a channel multiple times. The socket.io side is
# handled by RoomManager.

module.exports = ChannelManager =
    getClientMapEntry: (rclient) ->
        # return the rclient channel set if it exists, otherwise create and
        # return an empty set for the client.
        ClientMap.get(rclient) || ClientMap.set(rclient, new Map()).get(rclient)

    subscribe: (rclient, baseChannel, id) ->
        existingChannelSet = @getClientMapEntry(rclient)
        channel = "#{baseChannel}:#{id}"
        if existingChannelSet.has(channel)
            logger.error {channel}, "already subscribed - shouldn't happen"
            # return the subscribe promise, so we can wait for it to resolve
            return existingChannelSet.get(channel)
        else
            # get the subscribe promise and return it, the actual subscribe
            # completes in the background
            subscribePromise = rclient.subscribe channel 
            existingChannelSet.set(channel, subscribePromise)
            logger.log {channel}, "subscribed to new channel"
            metrics.inc "subscribe.#{baseChannel}"
            return subscribePromise

    unsubscribe: (rclient, baseChannel, id) ->
        existingChannelSet = @getClientMapEntry(rclient)
        channel = "#{baseChannel}:#{id}"
        if !existingChannelSet.has(channel)
            logger.error {channel}, "not subscribed - shouldn't happen"
        else
            rclient.unsubscribe channel # completes in the background
            existingChannelSet.delete(channel)
            logger.log {channel}, "unsubscribed from channel"
            metrics.inc "unsubscribe.#{baseChannel}"

    publish: (rclient, baseChannel, id, data) ->
        if id is 'all' or !settings.publishOnIndividualChannels
            channel = baseChannel
        else
            channel = "#{baseChannel}:#{id}"
        # we publish on a different client to the subscribe, so we can't
        # check for the channel existing here
        rclient.publish channel, data
