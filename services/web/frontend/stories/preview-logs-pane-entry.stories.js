import React from 'react'
import PreviewLogsPaneEntry from '../js/features/preview/components/preview-logs-pane-entry.js'
import Icon from '../js/shared/components/icon.js'

export const EntryWithCompilerOutput = args => (
  <PreviewLogsPaneEntry {...args} />
)
EntryWithCompilerOutput.args = {
  title: 'PreviewLogsPaneEntry/bar/baz',
  level: 'error'
}

export const EntryWithCompilerOutputAndHumanReadableHint = args => (
  <PreviewLogsPaneEntry {...args} />
)
EntryWithCompilerOutputAndHumanReadableHint.args = {
  level: 'error',
  formattedContent: <SampleHumanReadableHintComponent />,
  extraInfoURL:
    'https://www.overleaf.com/learn/latex/Errors/Extra_alignment_tab_has_been_changed_to_%5Ccr'
}

export const EntryWithoutCompilerOutput = args => (
  <PreviewLogsPaneEntry {...args} />
)
EntryWithoutCompilerOutput.args = {
  level: 'error',
  rawContent: null
}

export const EntryWithoutSourceLocationLink = args => (
  <PreviewLogsPaneEntry {...args} />
)
EntryWithoutSourceLocationLink.args = {
  level: 'error',
  showSourceLocationLink: false
}

export const EntryWithLevelError = args => <PreviewLogsPaneEntry {...args} />
EntryWithLevelError.args = {
  level: 'error'
}

export const EntryWithLevelWarning = args => <PreviewLogsPaneEntry {...args} />
EntryWithLevelWarning.args = {
  level: 'warning'
}

export const EntryWithLevelTypesetting = args => (
  <PreviewLogsPaneEntry {...args} />
)
EntryWithLevelTypesetting.args = {
  level: 'typesetting'
}

export const EntryWithLevelRaw = args => <PreviewLogsPaneEntry {...args} />
EntryWithLevelRaw.args = {
  level: 'raw'
}

export const EntryWithLevelSuccess = args => <PreviewLogsPaneEntry {...args} />
EntryWithLevelSuccess.args = {
  level: 'success'
}

export const EntryWithButtonToClose = args => <PreviewLogsPaneEntry {...args} />
EntryWithButtonToClose.args = {
  level: 'error',
  showCloseButton: true,
  onClose: () => window.alert('You clicked "×"')
}

export const EntryWithIcon = args => <PreviewLogsPaneEntry {...args} />
EntryWithIcon.args = {
  level: 'error',
  headerIcon: <Icon type="taxi" />
}

export const EntryWithBetaIcon = args => <PreviewLogsPaneEntry {...args} />
EntryWithBetaIcon.args = {
  level: 'typesetting',
  headerIcon: <span className="beta-badge" />
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
    headerTitle: 'Entry title',
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
