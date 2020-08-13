/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

module.exports = function(obj, methodName, prefix, logger) {
	let modifedMethodName;
	const metrics = require('./index');

	if (typeof obj[methodName] !== 'function') {
		throw new Error(`[Metrics] expected object property '${methodName}' to be a function`);
	}

	const key = `${prefix}.${methodName}`;

	const realMethod = obj[methodName];

	const splitPrefix = prefix.split(".");
	const startPrefix = splitPrefix[0];

	if (splitPrefix[1] != null) {
		modifedMethodName = `${splitPrefix[1]}_${methodName}`;
	} else {
		modifedMethodName = methodName;
	}
	return obj[methodName] = function(...originalArgs) {

		const adjustedLength = Math.max(originalArgs.length, 1), firstArgs = originalArgs.slice(0, adjustedLength - 1), callback = originalArgs[adjustedLength - 1];

		if ((callback == null) || (typeof callback !== 'function')) {
			if (logger != null) {
				logger.log(`[Metrics] expected wrapped method '${methodName}' to be invoked with a callback`);
			}
			return realMethod.apply(this, originalArgs);
		}

		const timer = new metrics.Timer(startPrefix, 1, {method: modifedMethodName});

		return realMethod.call(this, ...Array.from(firstArgs), function(...callbackArgs) {
			const elapsedTime = timer.done();
			const possibleError = callbackArgs[0];
			if (possibleError != null) { 
				metrics.inc(`${startPrefix}_result`, 1, {status:"failed", method: modifedMethodName});
			} else {
				metrics.inc(`${startPrefix}_result`, 1, {status:"success", method: modifedMethodName});
			}
			if (logger != null) {
				const loggableArgs = {};
				try {
					for (let idx = 0; idx < firstArgs.length; idx++) {
						const arg = firstArgs[idx];
						if (arg.toString().match(/^[0-9a-f]{24}$/)) {
							loggableArgs[`${idx}`] = arg;
						}
					}
				} catch (error) {}
				logger.log({key, args: loggableArgs, elapsedTime}, "[Metrics] timed async method call");
			}
			return callback.apply(this, callbackArgs);
		});
	};
};
