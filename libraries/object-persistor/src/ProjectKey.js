const path = require('node:path')

//
// The advice in http://docs.aws.amazon.com/AmazonS3/latest/dev/
// request-rate-perf-considerations.html is to avoid sequential key prefixes,
// so we reverse the project ID part of the key as they suggest.
//
function format(projectId) {
  const prefix = naiveReverse(pad(projectId))
  return path.join(prefix.slice(0, 3), prefix.slice(3, 6), prefix.slice(6))
}

function pad(number) {
  return (number || 0).toString().padStart(9, '0')
}

function naiveReverse(string) {
  return string.split('').reverse().join('')
}

exports.format = format
exports.pad = pad
exports.naiveReverse = naiveReverse
