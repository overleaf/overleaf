export default function createIcon(type) {
  const icon = document.createElement('span')
  icon.className = 'material-symbols'
  icon.setAttribute('aria-hidden', 'true')
  icon.setAttribute('translate', 'no')
  icon.textContent = type
  return icon
}
