import { captureMessage } from './infrastructure/error-reporter'

if (window.ExposedSettings.isOverleaf) {
  const cdnLoadTest = document.createElement('img')
  cdnLoadTest.addEventListener('error', function () {
    captureMessage('CDN test image load error (cdn.overleaf.net)')
  })
  cdnLoadTest.src = 'https://cdn.overleaf.net/img/1p.gif'

  const cdnLoadTestOld = document.createElement('img')
  cdnLoadTestOld.addEventListener('error', function () {
    captureMessage('CDN test image load error (cdn.overleaf.com)')
  })
  cdnLoadTestOld.src = 'https://cdn.overleaf.com/img/1p.gif'
}
