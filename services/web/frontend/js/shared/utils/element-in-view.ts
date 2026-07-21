export function elementIsInView(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  // Any vertical intersection with the viewport counts as "in view".
  return rect.bottom > 0 && rect.top < window.innerHeight
}
