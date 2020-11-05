import React from 'react'
import PreviewLogEntry from '../js/features/preview/components/preview-log-entry.js'

export const ErrorWithCompilerOutput = args => <PreviewLogEntry {...args} />
ErrorWithCompilerOutput.args = {
  level: 'error'
}

export const ErrorWithCompilerOutputAndHumanReadableHint = args => (
  <PreviewLogEntry {...args} />
)
ErrorWithCompilerOutputAndHumanReadableHint.args = {
  level: 'error',
  humanReadableHintComponent: <SampleHumanReadableHintComponent />,
  extraInfoURL:
    'https://www.overleaf.com/learn/latex/Errors/Extra_alignment_tab_has_been_changed_to_%5Ccr'
}

export const ErrorWithoutCompilerOutput = args => <PreviewLogEntry {...args} />
ErrorWithoutCompilerOutput.args = {
  level: 'error',
  content: null
}

export const WarningWithCompilerOutput = args => <PreviewLogEntry {...args} />
WarningWithCompilerOutput.args = {
  level: 'warning'
}

export const WarningWithCompilerOutputAndHumanReadableHint = args => (
  <PreviewLogEntry {...args} />
)
WarningWithCompilerOutputAndHumanReadableHint.args = {
  level: 'warning',
  humanReadableHintComponent: <SampleHumanReadableHintComponent />,
  extraInfoURL:
    'https://www.overleaf.com/learn/latex/Errors/Extra_alignment_tab_has_been_changed_to_%5Ccr'
}

export const WarningWithoutCompilerOutput = args => (
  <PreviewLogEntry {...args} />
)
WarningWithoutCompilerOutput.args = {
  level: 'warning',
  content: null
}

export const InfoWithCompilerOutput = args => <PreviewLogEntry {...args} />
InfoWithCompilerOutput.args = {
  level: 'typesetting'
}

export const InfoWithCompilerOutputAndHumanReadableHint = args => (
  <PreviewLogEntry {...args} />
)
InfoWithCompilerOutputAndHumanReadableHint.args = {
  level: 'typesetting',
  humanReadableHintComponent: <SampleHumanReadableHintComponent />,
  extraInfoURL:
    'https://www.overleaf.com/learn/latex/Errors/Extra_alignment_tab_has_been_changed_to_%5Ccr'
}

export const InfoWithoutCompilerOutput = args => <PreviewLogEntry {...args} />
InfoWithoutCompilerOutput.args = {
  level: 'typesetting',
  content: null
}

function SampleHumanReadableHintComponent() {
  return (
    <>
      Human-readable hint to help LaTeX newbies. Supports <b>mark-up</b> for
      e.g.{' '}
      <a
        target="_blank"
        rel="noopener noreferrer"
        href="https://www.overleaf.com/learn/latex/Errors/Extra_alignment_tab_has_been_changed_to_%5Ccr"
      >
        inline links
      </a>
      .
    </>
  )
}

export default {
  title: 'PreviewLogEntry',
  component: PreviewLogEntry,
  args: {
    file: 'foo/bar.tex',
    line: 10,
    column: 20,
    message: 'Lorem ipsum',
    content: `
The LaTeX compiler output
  * With a lot of details

Wrapped in an HTML <pre> element with 
      preformatted text which is to be presented exactly
            as written in the HTML file

                                              (whitespace included™)

The text is typically rendered using a non-proportional ("monospace") font.

LaTeX Font Info:    External font \`cmex10' loaded for size
(Font)              <7> on input line 18.
LaTeX Font Info:    External font \`cmex10' loaded for size
(Font)              <5> on input line 18.
! Undefined control sequence.
<recently read> \\Zlpha

 main.tex, line 23
     
`
  }
}
