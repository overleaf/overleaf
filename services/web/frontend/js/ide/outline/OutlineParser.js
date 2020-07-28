const COMMAND_LEVELS = {
  book: 10,
  part: 20,
  chapter: 30,
  section: 40,
  subsection: 50,
  subsubsection: 60,
  paragraph: 70,
  subparagraph: 80
}

/*
 *
 * RegExp matcher parts:
 *
 * REGEX_START: begining of line, any number of spaces, double \ (required)
 * REGEX_COMMAND: any of the listed commands (required)
 * REGEX_SPACING: spaces and * between groups (optional)
 * REGEX_SHORT_TITLE: a text between square brackets (optional)
 * REGEX_TITLE: a text between curly brackets (required)
 *
 */
const REGEX_START = '^\\s*\\\\'
const REGEX_COMMAND = `(${Object.keys(COMMAND_LEVELS).join('|')})`
const REGEX_SPACING = '\\s?\\*?\\s?'
const REGEX_SHORT_TITLE = '(\\[([^\\]]+)\\])?'
const REGEX_TITLE = '{(.*)}'
const MATCHER = new RegExp(
  `${REGEX_START}${REGEX_COMMAND}${REGEX_SPACING}${REGEX_SHORT_TITLE}${REGEX_SPACING}${REGEX_TITLE}`
)

function matchOutline(content) {
  const lines = content.split('\n')
  const flatOutline = []
  lines.forEach((line, lineId) => {
    const match = line.match(MATCHER)
    if (!match) return
    const [, command, , shortTitle, title] = match

    flatOutline.push({
      line: lineId + 1,
      title: matchDisplayTitle(shortTitle || title),
      level: COMMAND_LEVELS[command]
    })
  })
  return flatOutline
}

const DISPLAY_TITLE_REGEX = new RegExp('([^\\\\]*)\\\\([^{]+){([^}]+)}(.*)')
/*
 * Attempt to improve the display of the outline title for titles with commands.
 * Either skip the command (for labels) or display the command's content instead
 * of the entire command.
 *
 * e.g. "Label \\label{foo} between" => "Label  between"
 * e.g. "TT \\texttt{Bar}" => "TT Bar"
 *
 */
function matchDisplayTitle(title) {
  const closingBracketPosition = title.indexOf('}')
  if (closingBracketPosition < 0) {
    // simple title (no commands)
    return title
  }

  const titleMatch = title.match(DISPLAY_TITLE_REGEX)
  if (!titleMatch) {
    // no contained commands; strip everything after the first closing bracket
    return title.substring(0, closingBracketPosition)
  }

  const [, textBefore, command, commandContent, textAfter] = titleMatch
  if (command === 'label') {
    // label: don't display them at all
    title = `${textBefore}${textAfter}`
  } else {
    // display the content of the command. Works well for formatting commands
    title = `${textBefore}${commandContent}${textAfter}`
  }

  return title
}

function nestOutline(flatOutline) {
  let parentOutlines = {}
  let nestedOutlines = []
  flatOutline.forEach(outline => {
    const parentOutlineLevels = Object.keys(parentOutlines)

    // find the nearest parent outline
    const nearestParentLevel = parentOutlineLevels
      .reverse()
      .find(level => level < outline.level)
    const parentOutline = parentOutlines[nearestParentLevel]
    if (!parentOutline) {
      // top level
      nestedOutlines.push(outline)
    } else if (!parentOutline.children) {
      // first outline in this node
      parentOutline.children = [outline]
    } else {
      // push outline to node
      parentOutline.children.push(outline)
    }

    // store the outline as new parent at its level and forget lower-level
    // outlines (if any) as they shouldn't get any children anymore
    parentOutlines[outline.level] = outline
    parentOutlineLevels
      .filter(level => level > outline.level)
      .forEach(level => delete parentOutlines[level])
  })
  return nestedOutlines
}

export { matchOutline, nestOutline }
