/* eslint-disable
    no-proto,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
let Errors;
var CodedError = function(message, code) {
	const error = new Error(message);
	error.name = "CodedError";
	error.code = code;
	error.__proto__ = CodedError.prototype;
	return error;
};
CodedError.prototype.__proto__ = Error.prototype;

module.exports = (Errors =
	{CodedError});
