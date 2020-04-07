logger = require 'logger-sharelatex'
metrics = require "metrics-sharelatex"
settings = require "settings-sharelatex"

ClientMap = new Map() # for each redis client, store a Map of subscribed channels (channelname -> subscribe promise)

# Manage redis pubsub subscriptions for individual projects and docs, ensuring
# that we never subscribe to a channel multiple times. The socket.io side is
# handled by RoomManager.

module.exports = ChannelManager =
    getClientMapEntry: (rclient) ->
        # return the per-client channel map if it exists, otherwise create and
        # return an empty map for the client.
        ClientMap.get(rclient) || ClientMap.set(rclient, new Map()).get(rclient)

    subscribe: (rclient, baseChannel, id) ->
        clientChannelMap = @getClientMapEntry(rclient)
        channel = "#{baseChannel}:#{id}"
        # we track pending subscribes because we want to be sure that the
        # channel is active before letting the client join the doc or project,
        # so that events are not lost.
        if clientChannelMap.has(channel)
            logger.warn {channel}, "subscribe already actioned"
            # return the existing subscribe promise, so we can wait for it to resolve
            return clientChannelMap.get(channel)
        else
            # get the subscribe promise and return it, the actual subscribe
            # completes in the background
            subscribePromise = rclient.subscribe channel
            clientChannelMap.set(channel, subscribePromise)
            logger.log {channel}, "subscribed to new channel"
            metrics.inc "subscribe.#{baseChannel}"
            return subscribePromise

    unsubscribe: (rclient, baseChannel, id) ->
        clientChannelMap = @getClientMapEntry(rclient)
        channel = "#{baseChannel}:#{id}"
        # we don't need to track pending unsubscribes, because we there is no
        # harm if events continue to arrive on the channel while the unsubscribe
        # command in pending.
        if !clientChannelMap.has(channel)
            logger.error {channel}, "not subscribed - shouldn't happen"
        else
            rclient.unsubscribe channel # completes in the background
            clientChannelMap.delete(channel)
            logger.log {channel}, "unsubscribed from channel"
            metrics.inc "unsubscribe.#{baseChannel}"

    publish: (rclient, baseChannel, id, data) ->
        metrics.summary "redis.publish.#{baseChannel}", data.length
        if id is 'all' or !settings.publishOnIndividualChannels
            channel = baseChannel
        else
            channel = "#{baseChannel}:#{id}"
        # we publish on a different client to the subscribe, so we can't
        # check for the channel existing here
        rclient.publish channel, data
