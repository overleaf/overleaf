import { WidgetType } from '@codemirror/view'

export class SpaceWidget extends WidgetType {
  constructor(public width: string) {
    super()
  }

  toDOM() {
    const element = document.createElement('span')
    element.classList.add('ol-cm-space')
    element.style.width = this.width
    return element
  }

  eq(widget: SpaceWidget) {
    return widget.width === this.width
  }

  updateDOM(element: HTMLElement): boolean {
    element.style.width = this.width
    return true
  }

  ignoreEvent(event: Event) {
    return event.type !== 'mousedown' && event.type !== 'mouseup'
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }
}

// https://tex.stackexchange.com/a/74354
export const COMMAND_WIDTHS = new Map([
  // thin space
  ['\\thinspace', 'calc(3em / 18)'],
  ['\\,', 'calc(3em / 18)'],
  // negative thin space
  ['\\negthinspace', 'calc(-3em / 18)'],
  ['\\!', 'calc(-3em / 18)'],
  // medium space
  ['\\medspace', 'calc(4em / 18)'],
  ['\\:', 'calc(4em / 18)'],
  ['\\>', 'calc(4em / 18)'],
  // thick space
  ['\\thickspace', 'calc(5em / 18)'],
  ['\\;', 'calc(5em / 18)'],
  // negative thick space
  ['\\negthickspace', 'calc(-5em / 18)'],
  // en, em and 2xem spaces
  ['\\enspace', '0.5em'],
  ['\\quad', '1em'],
  ['\\qquad', '2em'],
])

export function createSpaceCommand(command: string): SpaceWidget | undefined {
  const width = COMMAND_WIDTHS.get(command)
  if (width !== undefined) {
    return new SpaceWidget(width)
  }
}

export function hasSpaceSubstitution(command: string): boolean {
  return COMMAND_WIDTHS.has(command)
}
