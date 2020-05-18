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
        actualSubscribe = () ->
            # subscribe is happening in the foreground and it should reject
            p = rclient.subscribe(channel)
            p.finally () ->
                if clientChannelMap.get(channel) is subscribePromise
                    clientChannelMap.delete(channel)
            .then () ->
                logger.log {channel}, "subscribed to channel"
                metrics.inc "subscribe.#{baseChannel}"
            .catch (err) ->
                logger.error {channel, err}, "failed to subscribe to channel"
                metrics.inc "subscribe.failed.#{baseChannel}"
            return p

        pendingActions = clientChannelMap.get(channel) || Promise.resolve()
        subscribePromise = pendingActions.then(actualSubscribe, actualSubscribe)
        clientChannelMap.set(channel, subscribePromise)
        logger.log {channel}, "planned to subscribe to channel"
        return subscribePromise

    unsubscribe: (rclient, baseChannel, id) ->
        clientChannelMap = @getClientMapEntry(rclient)
        channel = "#{baseChannel}:#{id}"
        actualUnsubscribe = () ->
            # unsubscribe is happening in the background, it should not reject
            p = rclient.unsubscribe(channel)
            .finally () ->
                if clientChannelMap.get(channel) is unsubscribePromise
                    clientChannelMap.delete(channel)
            .then () ->
                logger.log {channel}, "unsubscribed from channel"
                metrics.inc "unsubscribe.#{baseChannel}"
            .catch (err) ->
                logger.error {channel, err}, "unsubscribed from channel"
                metrics.inc "unsubscribe.failed.#{baseChannel}"
            return p

        pendingActions = clientChannelMap.get(channel) || Promise.resolve()
        unsubscribePromise = pendingActions.then(actualUnsubscribe, actualUnsubscribe)
        clientChannelMap.set(channel, unsubscribePromise)
        logger.log {channel}, "planned to unsubscribe from channel"
        return unsubscribePromise

    publish: (rclient, baseChannel, id, data) ->
        metrics.summary "redis.publish.#{baseChannel}", data.length
        if id is 'all' or !settings.publishOnIndividualChannels
            channel = baseChannel
        else
            channel = "#{baseChannel}:#{id}"
        # we publish on a different client to the subscribe, so we can't
        # check for the channel existing here
        rclient.publish channel, data
