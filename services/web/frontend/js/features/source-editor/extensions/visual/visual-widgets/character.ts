import { WidgetType } from '@codemirror/view'

export class CharacterWidget extends WidgetType {
  constructor(public content: string) {
    super()
  }

  toDOM() {
    const element = document.createElement('span')
    element.classList.add('ol-cm-character')
    element.textContent = this.content
    return element
  }

  eq(widget: CharacterWidget) {
    return widget.content === this.content
  }

  updateDOM(element: HTMLElement): boolean {
    element.textContent = this.content
    return true
  }

  ignoreEvent(event: Event) {
    return event.type !== 'mousedown' && event.type !== 'mouseup'
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }
}

export const COMMAND_SUBSTITUTIONS = new Map([
  ['\\', ' '], // a trimmed \\ '
  ['\\%', '\u0025'],
  ['\\_', '\u005F'],
  ['\\}', '\u007D'],
  ['\\~', '\u007E'],
  ['\\&', '\u0026'],
  ['\\#', '\u0023'],
  ['\\{', '\u007B'],
  ['\\$', '\u0024'],
  ['\\textasciicircum', '\u005E'],
  ['\\textless', '\u003C'],
  ['\\textasciitilde', '\u007E'],
  ['\\textordfeminine', '\u00AA'],
  ['\\textasteriskcentered', '\u204E'],
  ['\\textordmasculine', '\u00BA'],
  ['\\textbackslash', '\u005C'],
  ['\\textparagraph', '\u00B6'],
  ['\\textbar', '\u007C'],
  ['\\textperiodcentered', '\u00B7'],
  ['\\textbardbl', '\u2016'],
  ['\\textpertenthousand', '\u2031'],
  ['\\textperthousand', '\u2030'],
  ['\\textbraceleft', '\u007B'],
  ['\\textquestiondown', '\u00BF'],
  ['\\textbraceright', '\u007D'],
  ['\\textquotedblleft', '\u201C'],
  ['\\textbullet', '\u2022'],
  ['\\textquotedblright', '\u201D'],
  ['\\textcopyright', '\u00A9'],
  ['\\textquoteleft', '\u2018'],
  ['\\textdagger', '\u2020'],
  ['\\textquoteright', '\u2019'],
  ['\\textdaggerdbl', '\u2021'],
  ['\\textregistered', '\u00AE'],
  ['\\textdollar', '\u0024'],
  ['\\textsection', '\u00A7'],
  ['\\textellipsis', '\u2026'],
  ['\\textsterling', '\u00A3'],
  ['\\textemdash', '\u2014'],
  ['\\texttrademark', '\u2122'],
  ['\\textendash', '\u2013'],
  ['\\textunderscore', '\u005F'],
  ['\\textexclamdown', '\u00A1'],
  ['\\textvisiblespace', '\u2423'],
  ['\\textgreater', '\u003E'],
  ['\\ddag', '\u2021'],
  ['\\pounds', '\u00A3'],
  ['\\copyright', '\u00A9'],
  ['\\dots', '\u2026'],
  ['\\S', '\u00A7'],
  ['\\dag', '\u2020'],
  ['\\P', '\u00B6'],
  ['\\aa', '\u00E5'],
  ['\\DH', '\u00D0'],
  ['\\L', '\u0141'],
  ['\\o', '\u00F8'],
  ['\\th', '\u00FE'],
  ['\\AA', '\u00C5'],
  ['\\DJ', '\u0110'],
  ['\\l', '\u0142'],
  ['\\oe', '\u0153'],
  ['\\TH', '\u00DE'],
  ['\\AE', '\u00C6'],
  ['\\dj', '\u0111'],
  ['\\NG', '\u014A'],
  ['\\OE', '\u0152'],
  ['\\ae', '\u00E6'],
  ['\\IJ', '\u0132'],
  ['\\ng', '\u014B'],
  ['\\ss', '\u00DF'],
  ['\\dh', '\u00F0'],
  ['\\ij', '\u0133'],
  ['\\O', '\u00D8'],
  ['\\SS', '\u1E9E'],
  ['\\guillemetleft', '\u00AB'],
  ['\\guilsinglleft', '\u2039'],
  ['\\quotedblbase', '\u201E'],
  ['\\textquotedbl', '\u0022'],
  ['\\guillemetright', '\u00BB'],
  ['\\guilsinglright', '\u203A'],
  ['\\quotesinglbase', '\u201A'],
  ['\\textbaht', '\u0E3F'],
  ['\\textdollar', '\u0024'],
  ['\\textwon', '\u20A9'],
  ['\\textcent', '\u00A2'],
  ['\\textlira', '\u20A4'],
  ['\\textyen', '\u00A5'],
  ['\\textcentoldstyle', '\u00A2'],
  ['\\textdong', '\u20AB'],
  ['\\textnaira', '\u20A6'],
  ['\\textcolonmonetary', '\u20A1'],
  ['\\texteuro', '\u20AC'],
  ['\\textpeso', '\u20B1'],
  ['\\textcurrency', '\u00A4'],
  ['\\textflorin', '\u0192'],
  ['\\textsterling', '\u00A3'],
  ['\\textcircledP', '\u2117'],
  ['\\textcopyright', '\u00A9'],
  ['\\textservicemark', '\u2120'],
  ['\\textregistered', '\u00AE'],
  ['\\texttrademark', '\u2122'],
  ['\\textblank', '\u2422'],
  ['\\textpilcrow', '\u00B6'],
  ['\\textbrokenbar', '\u00A6'],
  ['\\textquotesingle', '\u0027'],
  ['\\textdblhyphen', '\u2E40'],
  ['\\textdblhyphenchar', '\u2E40'],
  ['\\textdiscount', '\u2052'],
  ['\\textrecipe', '\u211E'],
  ['\\textestimated', '\u212E'],
  ['\\textreferencemark', '\u203B'],
  ['\\textinterrobang', '\u203D'],
  ['\\textthreequartersemdash', '\u2014'],
  ['\\textinterrobangdown', '\u2E18'],
  ['\\texttildelow', '\u02F7'],
  ['\\textnumero', '\u2116'],
  ['\\texttwelveudash', '\u2014'],
  ['\\textopenbullet', '\u25E6'],
  ['\\ldots', '\u2026'],
])

export function createCharacterCommand(
  command: string
): CharacterWidget | undefined {
  const substitution = COMMAND_SUBSTITUTIONS.get(command)
  if (substitution !== undefined) {
    return new CharacterWidget(substitution)
  }
}

export function hasCharacterSubstitution(command: string): boolean {
  return COMMAND_SUBSTITUTIONS.has(command)
}
