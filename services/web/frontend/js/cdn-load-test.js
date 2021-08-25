import { captureMessage } from './infrastructure/error-reporter'

var cdnLoadTest = document.createElement('img')
cdnLoadTest.addEventListener('error', function (event) {
  captureMessage('CDN test image load error (cdn.overleaf.net)')
})
cdnLoadTest.src = 'https://cdn.overleaf.net/img/1p.gif'
