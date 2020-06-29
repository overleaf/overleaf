const COMMAND_LEVELS = {
  section: 0,
  subsection: 1,
  subsubsection: 2
}

function matchOutline(content) {
  const lines = content.split('\n')
  const flatOutline = []
  lines.forEach((line, lineId) => {
    const match = line.match(/\\(?<command>[sub]*section)\{(?<title>[^}]+)\}/)
    if (!match) return
    const {
      groups: { command, title }
    } = match
    flatOutline.push({
      line: lineId + 1,
      title,
      level: COMMAND_LEVELS[command]
    })
  })
  return flatOutline
}

function nestOutline(flatOutline) {
  let parentOutlines = {}
  let nestedOutlines = []
  flatOutline.forEach(outline => {
    const parentOutline = parentOutlines[outline.level - 1]
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
    parentOutlines[outline.level] = outline
  })
  return nestedOutlines
}

function parseOutline(content) {
  const flatOutline = matchOutline(content)
  return nestOutline(flatOutline)
}

export default parseOutline
