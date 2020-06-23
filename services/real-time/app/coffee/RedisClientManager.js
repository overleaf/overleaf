/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let RedisClientManager;
const redis = require("redis-sharelatex");
const logger = require('logger-sharelatex');

module.exports = (RedisClientManager = {
    createClientList(...configs) {
        // create a dynamic list of redis clients, excluding any configurations which are not defined
        const clientList = (() => {
            const result = [];
            for (let x of Array.from(configs)) {
                if (x != null) {
                    const redisType = (x.cluster != null) ?
                        "cluster"
                    : (x.sentinels != null) ?
                        "sentinel"
                    : (x.host != null) ?
                        "single"
                    :
                        "unknown";
                    logger.log({redis: redisType}, "creating redis client");
                    result.push(redis.createClient(x));
                }
            }
            return result;
        })();
        return clientList;
    }
});