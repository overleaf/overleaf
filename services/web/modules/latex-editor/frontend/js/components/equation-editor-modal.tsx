import React, { FC, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MathLiveInput } from './mathlive-input'
import { latexCommands } from '../data/latex-commands.mjs'
import { searchCommands } from '../utils/command-search.mjs'
import {
  DEFAULT_WRAPPER,
  splitEquation,
  wrapLatex,
} from '../utils/equation-export.mjs'

type Props = {
    onInsert: (latex: string) => void
    onImport: () => string
    onClose: () => void
    initialLatex?: string
}

type ExportWrapper = 'plain' | 'equation' | 'eqnarray' | 'inline' | 'display'

export const EquationEditorModal: FC<Props> = ({
    onInsert,
    onImport,
    onClose,
    initialLatex,
}) => {
    const { t } = useTranslation()
    // Pre-loaded content (e.g. from "Open in Equation Editor") is split into
    // body + environment, so the modal always holds a coherent pair that
    // wrapLatex(body, wrapper) can reproduce exactly.
    const initialSplit = initialLatex ? splitEquation(initialLatex) : null
    const [latex, setLatex] = useState(initialSplit ? initialSplit.body : '')
    const [minimized, setMinimized] = useState(false)
    const [showRawLatex, setShowRawLatex] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchOpen, setSearchOpen] = useState(false)
    const [exportWrapper, setExportWrapper] = useState<ExportWrapper>(
      initialSplit ? (initialSplit.wrapper as ExportWrapper) : DEFAULT_WRAPPER
    )
    const [keyboardVisible, setKeyboardVisible] = useState(false)
    const mathfieldRef = useRef<any>(null)
    const modalRef = useRef<HTMLDivElement>(null)
    const searchWrapperRef = useRef<HTMLDivElement>(null)

    // Drag state
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
    const dragging = useRef(false)

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button, input, label')) return
        e.preventDefault()
        const modal = modalRef.current
        if (!modal) return
        const rect = modal.getBoundingClientRect()
        dragging.current = true
        setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
        if (!position) {
            setPosition({ x: rect.left, y: rect.top })
        }
    }, [position])

    useEffect(() => {
        if (!dragOffset) return
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragging.current) return
            const modal = modalRef.current
            const mw = modal?.offsetWidth ?? 840
            const mh = modal?.offsetHeight ?? 400
            const maxX = window.innerWidth - mw
            const maxY = window.innerHeight - mh
            setPosition({
                x: Math.max(0, Math.min(e.clientX - dragOffset.x, maxX)),
                y: Math.max(0, Math.min(e.clientY - dragOffset.y, maxY)),
            })
        }
        const handleMouseUp = () => {
            dragging.current = false
            setDragOffset(null)
        }
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [dragOffset])

    const modalStyle: React.CSSProperties | undefined = position
        ? { left: position.x, top: position.y, transform: 'none' }
        : undefined

    // Search across all commands
    const searchResults = useMemo(
        () => searchCommands(latexCommands, searchQuery),
        [searchQuery]
    )

    const insertIntoMathfield = useCallback((text: string) => {
        if (mathfieldRef.current) {
            mathfieldRef.current.executeCommand(['insert', text])
            mathfieldRef.current.focus()
        } else {
            setLatex(prev => prev + text)
        }
    }, [])

    const handleInsertCommand = useCallback((cmdLatex: string) => {
        insertIntoMathfield(cmdLatex)
        setSearchQuery('')
        setSearchOpen(false)
    }, [insertIntoMathfield])

    const handleExport = useCallback(() => {
        onInsert(wrapLatex(latex, exportWrapper))
    }, [latex, onInsert, exportWrapper])

    const handleImport = useCallback(() => {
        const selected = onImport()
        if (selected) {
            const { body, wrapper } = splitEquation(selected)
            setLatex(body)
            setExportWrapper(wrapper as ExportWrapper)
            if (mathfieldRef.current) {
                mathfieldRef.current.setValue(body)
            }
        }
    }, [onImport])

    const handleClear = useCallback(() => {
        setLatex('')
        if (mathfieldRef.current) {
            mathfieldRef.current.setValue('')
            mathfieldRef.current.focus()
        }
    }, [])

    // Close on Escape key (search dropdown first, then the editor window)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (searchOpen) {
                    setSearchOpen(false)
                    setSearchQuery('')
                } else {
                    onClose()
                }
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [onClose, searchOpen])

    // Close search dropdown when clicking outside
    useEffect(() => {
        if (!searchOpen) return
        const handleClick = (e: MouseEvent) => {
            if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
                setSearchOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [searchOpen])

    const header = (
      /* eslint-disable-next-line jsx-a11y/no-static-element-interactions */
      <div className="latex-editor-header" onMouseDown={handleMouseDown} style={{ cursor: 'grab' }}>
            <div className="latex-editor-header-group">
                <div className="latex-editor-title modal-title">
                    {t('equation_editor')}
                </div>
            </div>
            <div className="latex-editor-header-group latex-editor-actions">
                {!minimized && (
                    <label className="latex-editor-raw-toggle">
                        <input
                            type="checkbox"
                            checked={showRawLatex}
                            onChange={e => setShowRawLatex(e.target.checked)}
                        />
                        {t('equation_editor_show_raw_latex')}
                    </label>
                )}
                <button
                    type="button"
                    className="latex-editor-minimize"
                    onClick={() => setMinimized(!minimized)}
                    title={minimized ? t('equation_editor_restore') : t('equation_editor_minimize')}
                    aria-label={minimized ? t('equation_editor_restore') : t('equation_editor_minimize')}
                >
                    {minimized ? '□' : '−'}
                </button>
                <button
                    type="button"
                    className="latex-editor-close-button"
                    onClick={onClose}
                    aria-label={t('equation_editor_close_dialog')}
                />
            </div>
        </div>
    )

    if (minimized) {
        return (
            <div
                className="latex-editor-modal latex-editor--minimized"
                role="dialog"
                aria-modal="true"
                aria-label={t('equation_editor')}
                ref={modalRef}
                style={modalStyle}
            >
                {header}
            </div>
        )
    }

    return (
        <div
            className="latex-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('equation_editor')}
            ref={modalRef}
            style={modalStyle}
        >
            {header}

            <div className="latex-editor-body">
                <div className="latex-editor-content">
                    {showRawLatex ? (
                        <textarea
                            className="latex-editor-raw-textarea"
                            value={latex}
                            onChange={e => {
                                setLatex(e.target.value)
                                if (mathfieldRef.current) {
                                    mathfieldRef.current.setValue(e.target.value)
                                }
                            }}
                            placeholder={t('equation_editor_raw_latex_placeholder')}
                            aria-label={t('equation_editor_raw_latex_label')}
                        />
                    ) : (
                        <MathLiveInput
                            value={latex}
                            onChange={setLatex}
                            mathfieldRef={mathfieldRef}
                            keyboardVisible={keyboardVisible}
                        />
                    )}

                    <div className="latex-editor-action-bar">
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleImport}
                            title={t('equation_editor_import_selection_title')}
                        >
                            {t('equation_editor_import_selection')}
                        </button>

                        <div className="latex-editor-search-wrapper" ref={searchWrapperRef}>
                            <input
                                type="search"
                                className="latex-editor-search-input"
                                placeholder={t('equation_editor_search_placeholder')}
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value)
                                    setSearchOpen(e.target.value.trim().length > 0)
                                }}
                                onFocus={() => {
                                    if (searchQuery.trim()) setSearchOpen(true)
                                }}
                                aria-label={t('equation_editor_search_label')}
                            />
                            {searchOpen &&
                                searchQuery.trim() &&
                                (searchResults.length > 0 ? (
                                    <div className="latex-editor-search-dropdown">
                                        {searchResults.map((r, i) => (
                                            <button
                                                key={`${r.cmd}-${i}`}
                                                type="button"
                                                className="latex-editor-search-result"
                                                onClick={() => handleInsertCommand(r.insert ?? r.cmd)}
                                            >
                                                <code className="latex-editor-cmd-code">
                                                    {r.cmd}
                                                </code>
                                                <span className="latex-editor-cmd-desc">
                                                    {r.desc}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="latex-editor-search-dropdown">
                                        <div className="latex-editor-no-results">
                                            {t('equation_editor_no_results')}
                                        </div>
                                    </div>
                                ))}
                        </div>

                        <div className="latex-editor-action-spacer" />
                        <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={handleClear}
                            title={t('equation_editor_clear_title')}
                        >
                            {t('equation_editor_clear')}
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm latex-editor-keyboard-toggle ${keyboardVisible ? 'btn-secondary' : 'btn-outline-secondary'}`}
                            onClick={() => setKeyboardVisible(v => !v)}
                            title={
                                keyboardVisible
                                    ? t('equation_editor_hide_keyboard')
                                    : t('equation_editor_show_keyboard')
                            }
                            aria-label={
                                keyboardVisible
                                    ? t('equation_editor_hide_keyboard')
                                    : t('equation_editor_show_keyboard')
                            }
                            aria-pressed={keyboardVisible}
                        >
                            ⌨
                        </button>
                        <div className="latex-editor-export-group">
                            <select
                                className="latex-editor-export-select"
                                value={exportWrapper}
                                onChange={e => setExportWrapper(e.target.value as ExportWrapper)}
                                aria-label={t('equation_editor_export_wrapper')}
                                title={t('equation_editor_export_wrapper_title')}
                            >
                                <option value="plain">
                                    {t('equation_editor_wrap_plain')}
                                </option>
                                <option value="equation">
                                    {t('equation_editor_wrap_equation')}
                                </option>
                                <option value="eqnarray">
                                    {t('equation_editor_wrap_eqnarray')}
                                </option>
                                <option value="inline">
                                    {t('equation_editor_wrap_inline')}
                                </option>
                                <option value="display">
                                    {t('equation_editor_wrap_display')}
                                </option>
                            </select>
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={handleExport}
                                title={t('equation_editor_export_title')}
                            >
                                {t('equation_editor_export_to_cursor')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EquationEditorModal
