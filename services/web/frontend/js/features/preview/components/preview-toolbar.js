import React, { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import PreviewDownloadButton from './preview-download-button'
import PreviewRecompileButton from './preview-recompile-button'
import PreviewLogsToggleButton from './preview-logs-toggle-button'
import useResizeObserver from '../../../shared/hooks/use-resize-observer'

function _getElementWidth(element) {
  if (!element) return 0
  return Math.ceil(element.getBoundingClientRect().width)
}

function PreviewToolbar({
  compilerState,
  logsState,
  onClearCache,
  onRecompile,
  onRunSyntaxCheckNow,
  onSetAutoCompile,
  onSetDraftMode,
  onSetSyntaxCheck,
  onToggleLogs,
  outputFiles,
  pdfDownloadUrl,
  showLogs
}) {
  const showTextRef = useRef(true)
  const showToggleTextRef = useRef(true)
  const toolbarRef = useRef()
  const recompileWidthDifferenceRef = useRef()
  const recompileLongerTextRef = useRef()
  const [showText, setShowText] = useState(showTextRef.current)
  const [showToggleText, setShowToggleText] = useState(
    showToggleTextRef.current
  )

  function checkCanShowText(observedElement) {
    // toolbar items can be in 3 states:
    // all text, only toggle logs w/text and icons on others, all icons
    // states depend on available space in the toolbar
    const toolbarWidth =
      observedElement &&
      observedElement.contentRect &&
      observedElement.contentRect.width
    if (!toolbarWidth) return

    _checkRecompileStateWidths()

    let textWidths = 0
    let itemsWidth = _getItemsWidth() // could be with or without text

    // get widths of text only
    // required for _checkToggleText, even if currently showing text
    const textElements = toolbarRef.current.querySelectorAll('.toolbar-text')
    textElements.forEach(item => {
      if (item.getAttribute('aria-hidden') !== 'true') {
        textWidths += _getElementWidth(item)
      }
    })

    const logsToggleText = toolbarRef.current.querySelector(
      '#logs-toggle .toolbar-text'
    )
    const logsToggleTextWidth = _getElementWidth(logsToggleText)

    if (!showTextRef.current && !showToggleTextRef.current) {
      // itemsWidth was calculated without any text shown
      itemsWidth += textWidths
    } else if (!showTextRef.current && showToggleTextRef.current) {
      // itemsWidth was calculated with toggle text but no other text
      // only add text width for other items and then
      // subtract toggle text width, since it is already in itemsWidth
      itemsWidth += parseInt(textWidths - logsToggleTextWidth, 10)
    }

    // only add extra if recompile button is in state with smaller length
    if (
      recompileWidthDifferenceRef.current &&
      recompileLongerTextRef.current &&
      ((!compilerState.isCompiling &&
        recompileLongerTextRef.current === 'compiling') ||
        (compilerState.isCompiling &&
          recompileLongerTextRef.current === 'recompile'))
    ) {
      itemsWidth += recompileWidthDifferenceRef.current
    }

    itemsWidth += 10 // add extra for some spacing between items

    let canShowText = itemsWidth < toolbarWidth

    if (!canShowText) {
      _checkToggleText(
        toolbarWidth,
        logsToggleTextWidth,
        itemsWidth,
        textWidths
      )
    } else if (showToggleTextRef.current !== true) {
      setShowToggleText(true)
      showToggleTextRef.current = true
    }

    setShowText(canShowText)
    showTextRef.current = canShowText
  }

  function _checkRecompileStateWidths() {
    // check recompile/compiling button text.
    // Do not want to hide and then show text when recompiling
    if (
      recompileWidthDifferenceRef.current ||
      recompileWidthDifferenceRef.current === 0
    )
      return

    const textCompiling = toolbarRef.current.querySelector('#text-compiling')
    const textRecompile = toolbarRef.current.querySelector('#text-recompile')

    const textCompilingWidth = _getElementWidth(textCompiling)
    const textRecompileWidth = _getElementWidth(textRecompile)

    const textLengthDifference = Math.abs(
      parseInt(textCompilingWidth - textRecompileWidth, 10)
    )
    recompileWidthDifferenceRef.current = textLengthDifference
    // ignore if equal
    if (textRecompileWidth > textCompilingWidth) {
      recompileLongerTextRef.current = 'recompile'
    } else if (textRecompileWidth < textCompilingWidth) {
      recompileLongerTextRef.current = 'compiling'
    }
  }

  function _checkToggleText(
    toolbarWidth,
    logsToggleTextWidth,
    itemsWithTextWidth,
    textWidths
  ) {
    // check to see if we can still show the toggle button text
    let toggleWithTextWidth = 0
    let toggleWithoutTextWidth = 0
    const itemsWithoutTextWidth = parseInt(itemsWithTextWidth - textWidths, 10)
    const logsToggle = toolbarRef.current.querySelector('#logs-toggle')
    const logsToggleWidth = _getElementWidth(logsToggle)

    // logsToggleWidth could be with or without text
    if (showToggleTextRef.current) {
      toggleWithTextWidth = logsToggleWidth
      toggleWithoutTextWidth = parseInt(
        logsToggleWidth - logsToggleTextWidth,
        10
      )
    } else {
      toggleWithTextWidth = parseInt(logsToggleWidth + logsToggleTextWidth, 10)
      toggleWithoutTextWidth = logsToggleWidth
    }

    const itemsWithoutTextAndToggleWidth = parseInt(
      itemsWithoutTextWidth - toggleWithoutTextWidth,
      10
    )
    const itemsWithIconsExceptToggleWidth = parseInt(
      itemsWithoutTextAndToggleWidth + toggleWithTextWidth,
      10
    )
    const canShowToggleText = itemsWithIconsExceptToggleWidth < toolbarWidth

    if (canShowToggleText !== showToggleTextRef.current) {
      setShowToggleText(canShowToggleText)
      showToggleTextRef.current = canShowToggleText
    }
  }

  function _getItemsWidth() {
    const toolbarItems = toolbarRef.current.querySelectorAll('.toolbar-item')
    let itemWidth = 0
    toolbarItems.forEach(item => {
      itemWidth += _getElementWidth(item)
    })
    return itemWidth
  }

  useResizeObserver(toolbarRef, logsState, checkCanShowText)

  return (
    <div
      className="toolbar toolbar-pdf"
      id="toolbar-preview"
      data-testid="toolbar-preview"
      ref={toolbarRef}
    >
      <div className="toolbar-pdf-left">
        <PreviewRecompileButton
          compilerState={compilerState}
          onRecompile={onRecompile}
          onRunSyntaxCheckNow={onRunSyntaxCheckNow}
          onSetAutoCompile={onSetAutoCompile}
          onSetDraftMode={onSetDraftMode}
          onSetSyntaxCheck={onSetSyntaxCheck}
          onClearCache={onClearCache}
          showText={showText}
        />
        <PreviewDownloadButton
          isCompiling={compilerState.isCompiling}
          outputFiles={outputFiles}
          pdfDownloadUrl={pdfDownloadUrl}
          showText={showText}
        />
      </div>
      <div className="toolbar-pdf-right">
        <PreviewLogsToggleButton
          logsState={logsState}
          showLogs={showLogs}
          compileFailed={compilerState.compileFailed}
          onToggle={onToggleLogs}
          showText={showToggleText}
        />
      </div>
    </div>
  )
}

PreviewToolbar.propTypes = {
  compilerState: PropTypes.shape({
    isAutoCompileOn: PropTypes.bool.isRequired,
    isCompiling: PropTypes.bool.isRequired,
    isDraftModeOn: PropTypes.bool.isRequired,
    isSyntaxCheckOn: PropTypes.bool.isRequired,
    compileFailed: PropTypes.bool,
    logEntries: PropTypes.object.isRequired
  }),
  logsState: PropTypes.shape({
    nErrors: PropTypes.number.isRequired,
    nWarnings: PropTypes.number.isRequired,
    nLogEntries: PropTypes.number.isRequired
  }),
  showLogs: PropTypes.bool.isRequired,
  onClearCache: PropTypes.func.isRequired,
  onRecompile: PropTypes.func.isRequired,
  onRunSyntaxCheckNow: PropTypes.func.isRequired,
  onSetAutoCompile: PropTypes.func.isRequired,
  onSetDraftMode: PropTypes.func.isRequired,
  onSetSyntaxCheck: PropTypes.func.isRequired,
  onToggleLogs: PropTypes.func.isRequired,
  pdfDownloadUrl: PropTypes.string,
  outputFiles: PropTypes.array
}

export default PreviewToolbar
