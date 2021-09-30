export const ChkTeXParser = {
  parse(log) {
    const errors = []
    const warnings = []

    for (const line of log.split('\n')) {
      const m = line.match(/^(\S+):(\d+):(\d+): (Error|Warning): (.*)/)

      if (m) {
        const result = {
          file: m[1],
          line: m[2],
          column: m[3],
          level: m[4].toLowerCase(),
          message: `${m[4]}: ${m[5]}`,
        }

        if (result.level === 'error') {
          errors.push(result)
        } else {
          warnings.push(result)
        }
      }
    }

    return { errors, warnings }
  },
}
