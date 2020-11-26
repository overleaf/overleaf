import React from 'react'
import PreviewLogsPaneEntry from '../js/features/preview/components/preview-logs-pane-entry.js'

export const ErrorWithCompilerOutput = args => (
  <PreviewLogsPaneEntry {...args} />
)
ErrorWithCompilerOutput.args = {
  level: 'error'
}

export const ErrorWithCompilerOutputAndHumanReadableHint = args => (
  <PreviewLogsPaneEntry {...args} />
)
ErrorWithCompilerOutputAndHumanReadableHint.args = {
  level: 'error',
  formattedContent: <SampleHumanReadableHintComponent />,
  extraInfoURL:
    'https://www.overleaf.com/learn/latex/Errors/Extra_alignment_tab_has_been_changed_to_%5Ccr'
}

export const ErrorWithoutCompilerOutput = args => (
  <PreviewLogsPaneEntry {...args} />
)
ErrorWithoutCompilerOutput.args = {
  level: 'error',
  rawContent: null
}

export const WarningWithCompilerOutput = args => (
  <PreviewLogsPaneEntry {...args} />
)
WarningWithCompilerOutput.args = {
  level: 'warning'
}

export const WarningWithCompilerOutputAndHumanReadableHint = args => (
  <PreviewLogsPaneEntry {...args} />
)
WarningWithCompilerOutputAndHumanReadableHint.args = {
  level: 'warning',
  formattedContent: <SampleHumanReadableHintComponent />,
  extraInfoURL:
    'https://www.overleaf.com/learn/latex/Errors/Extra_alignment_tab_has_been_changed_to_%5Ccr'
}

export const WarningWithoutCompilerOutput = args => (
  <PreviewLogsPaneEntry {...args} />
)
WarningWithoutCompilerOutput.args = {
  level: 'warning',
  rawContent: null
}

export const InfoWithCompilerOutput = args => <PreviewLogsPaneEntry {...args} />
InfoWithCompilerOutput.args = {
  level: 'typesetting'
}

export const InfoWithCompilerOutputAndHumanReadableHint = args => (
  <PreviewLogsPaneEntry {...args} />
)
InfoWithCompilerOutputAndHumanReadableHint.args = {
  level: 'typesetting',
  formattedContent: <SampleHumanReadableHintComponent />,
  extraInfoURL:
    'https://www.overleaf.com/learn/latex/Errors/Extra_alignment_tab_has_been_changed_to_%5Ccr'
}

export const InfoWithoutCompilerOutput = args => (
  <PreviewLogsPaneEntry {...args} />
)
InfoWithoutCompilerOutput.args = {
  level: 'typesetting',
  rawContent: null
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
  title: 'PreviewLogsPaneEntry',
  component: PreviewLogsPaneEntry,
  args: {
    sourceLocation: {
      file: 'foo/bar.tex',
      line: 10,
      column: 20
    },
    headerTitle: 'Lorem ipsum',
    rawContent: `
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
