/* eslint-disable
    no-proto,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
let Errors;
var NotFoundError = function(message) {
	const error = new Error(message);
	error.name = "NotFoundError";
	error.__proto__ = NotFoundError.prototype;
	return error;
};
NotFoundError.prototype.__proto__ = Error.prototype;

module.exports = (Errors =
	{NotFoundError});

