export function materialIcon(type: string) {
  const icon = document.createElement('span')
  icon.className = 'material-symbols'
  icon.textContent = type
  icon.ariaHidden = 'true'
  icon.translate = false

  return icon
}
