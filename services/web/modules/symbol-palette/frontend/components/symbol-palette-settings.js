import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSymbolPaletteConfig } from '../context/symbol-palette-context'
import { getSymbolCharacter } from '../utils/symbol-character'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

function generateCodepoint() {
    // Generate a unique custom codepoint for user-added symbols
    return 'U+CUSTOM-' + Date.now().toString(16).toUpperCase() + '-' + Math.random().toString(16).slice(2, 6).toUpperCase()
}

function SymbolRow({ symbol, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
    const { t } = useTranslation()
    const [editing, setEditing] = useState(false)
    const [editCommand, setEditCommand] = useState(symbol.command)
    const [editDescription, setEditDescription] = useState(symbol.description)

    const handleSave = () => {
        onUpdate(symbol.codepoint, {
            command: editCommand,
            description: editDescription,
        })
        setEditing(false)
    }

    const handleCancel = () => {
        setEditCommand(symbol.command)
        setEditDescription(symbol.description)
        setEditing(false)
    }

    const displayChar = getSymbolCharacter(symbol, '?')

    if (editing) {
        return (
            <tr className="sp-settings-row">
                <td className="sp-settings-cell sp-settings-cell-symbol">{displayChar}</td>
                <td className="sp-settings-cell">
                    <OLFormControl
                        type="text"
                        value={editCommand}
                        onChange={e => setEditCommand(e.target.value)}
                        size="sm"
                    />
                </td>
                <td className="sp-settings-cell">
                    <OLFormControl
                        type="text"
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        size="sm"
                    />
                </td>
                <td className="sp-settings-cell sp-settings-cell-actions">
                    <button className="btn btn-sm btn-primary" onClick={handleSave}>
                        {t('save')}
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={handleCancel}>
                        {t('cancel')}
                    </button>
                </td>
            </tr>
        )
    }

    return (
        <tr className="sp-settings-row">
            <td className="sp-settings-cell sp-settings-cell-symbol">
                <OLTooltip
                    id={`symbol-settings-${symbol.codepoint}`}
                    description={symbol.description}
                    overlayProps={{ placement: 'top' }}
                >
                    <span>{displayChar}</span>
                </OLTooltip>
            </td>
            <td className="sp-settings-cell sp-settings-cell-command">{symbol.command}</td>
            <td className="sp-settings-cell">{symbol.description}</td>
            <td className="sp-settings-cell sp-settings-cell-actions">
                <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setEditing(true)}
                    title={t('edit')}
                >
                    ✎
                </button>
                <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => onMoveUp(symbol.codepoint)}
                    disabled={isFirst}
                    title="Move up"
                >
                    ↑
                </button>
                <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => onMoveDown(symbol.codepoint)}
                    disabled={isLast}
                    title="Move down"
                >
                    ↓
                </button>
                <button
                    className="btn btn-sm btn-danger"
                    onClick={() => onRemove(symbol.codepoint)}
                    title={t('remove')}
                >
                    ×
                </button>
            </td>
        </tr>
    )
}

function AddSymbolForm({ categoryId, onAdd }) {
    const { t } = useTranslation()
    const [character, setCharacter] = useState('')
    const [command, setCommand] = useState('')
    const [description, setDescription] = useState('')

    const handleAdd = () => {
        if (!command.trim()) return
        const codepoint = character
            ? 'U+' + character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')
            : generateCodepoint()

        onAdd({
            category: categoryId,
            command: command.trim(),
            codepoint,
            description: description.trim(),
            character: character || '',
            aliases: [],
            notes: '',
        })

        setCharacter('')
        setCommand('')
        setDescription('')
    }

    return (
        <tr className="sp-settings-row sp-settings-add-row">
            <td className="sp-settings-cell">
                <OLFormControl
                    type="text"
                    value={character}
                    onChange={e => setCharacter(e.target.value)}
                    placeholder="α"
                    size="sm"
                    className="sp-settings-input-symbol"
                />
            </td>
            <td className="sp-settings-cell">
                <OLFormControl
                    type="text"
                    value={command}
                    onChange={e => setCommand(e.target.value)}
                    placeholder="\alpha"
                    size="sm"
                />
            </td>
            <td className="sp-settings-cell">
                <OLFormControl
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Description / Tooltip"
                    size="sm"
                />
            </td>
            <td className="sp-settings-cell sp-settings-cell-actions">
                <button className="btn btn-sm btn-primary" onClick={handleAdd} disabled={!command.trim()}>
                    {t('add')}
                </button>
            </td>
        </tr>
    )
}

export default function SymbolPaletteSettings() {
    const { t } = useTranslation()
    const {
        categories,
        symbols,
        addCategory,
        removeCategory,
        addSymbol,
        removeSymbol,
        updateSymbol,
        reorderSymbols,
        resetToDefaults,
        exportConfig,
        importConfig,
    } = useSymbolPaletteConfig()

    const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || '')
    const [newCategoryName, setNewCategoryName] = useState('')
    const fileInputRef = useRef(null)

    // Re-select if the selected category disappears (e.g. after import or reset)
    useEffect(() => {
        if (!categories.some(c => c.id === selectedCategoryId)) {
            setSelectedCategoryId(categories[0]?.id || '')
        }
    }, [categories, selectedCategoryId])

    const categorySymbols = useMemo(() => {
        return symbols.filter(s => s.category === selectedCategoryId)
    }, [symbols, selectedCategoryId])

    const handleAddCategory = () => {
        const name = newCategoryName.trim()
        if (!name) return
        addCategory(name)
        setSelectedCategoryId(name)
        setNewCategoryName('')
    }

    const handleRemoveCategory = () => {
        if (!selectedCategoryId) return
        if (!window.confirm(t('symbol_palette_confirm_remove_category', { category: selectedCategoryId }))) return
        removeCategory(selectedCategoryId)
        if (categories.length > 1) {
            const remaining = categories.filter(c => c.id !== selectedCategoryId)
            setSelectedCategoryId(remaining[0]?.id || '')
        }
    }

    const handleMoveUp = useCallback((codepoint) => {
        const idx = categorySymbols.findIndex(s => s.codepoint === codepoint)
        if (idx <= 0) return
        const newArr = [...categorySymbols]
            ;[newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]]
        reorderSymbols(selectedCategoryId, newArr)
    }, [categorySymbols, selectedCategoryId, reorderSymbols])

    const handleMoveDown = useCallback((codepoint) => {
        const idx = categorySymbols.findIndex(s => s.codepoint === codepoint)
        if (idx < 0 || idx >= categorySymbols.length - 1) return
        const newArr = [...categorySymbols]
            ;[newArr[idx], newArr[idx + 1]] = [newArr[idx + 1], newArr[idx]]
        reorderSymbols(selectedCategoryId, newArr)
    }, [categorySymbols, selectedCategoryId, reorderSymbols])

    const handleExport = () => {
        const json = exportConfig()
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'symbol-palette-settings.json'
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleImport = (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        const reader = new window.FileReader()
        reader.onload = (e) => {
            const text = e.target?.result
            if (typeof text === 'string') {
                const success = importConfig(text)
                if (!success) {
                    window.alert(t('symbol_palette_import_error'))
                }
            }
        }
        reader.readAsText(file)
        // Reset file input so the same file can be re-imported
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleReset = () => {
        if (!window.confirm(t('symbol_palette_confirm_reset'))) return
        resetToDefaults()
        // Re-select first category after reset
        setSelectedCategoryId('Greek')
    }

    return (
        <div className="sp-settings">
            <div className="sp-settings-section">
                <h5 className="sp-settings-section-title">{t('symbol_palette_categories')}</h5>
                <div className="sp-settings-category-controls">
                    <select
                        className="form-control sp-settings-category-select"
                        value={selectedCategoryId}
                        onChange={e => setSelectedCategoryId(e.target.value)}
                    >
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.label || cat.id}</option>
                        ))}
                    </select>
                    <button
                        className="btn btn-sm btn-danger"
                        onClick={handleRemoveCategory}
                        disabled={categories.length <= 1}
                        title={t('symbol_palette_remove_category')}
                    >
                        −
                    </button>
                </div>
                <div className="sp-settings-add-category">
                    <OLFormControl
                        type="text"
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        placeholder={t('symbol_palette_new_category')}
                        size="sm"
                        onKeyDown={e => { if (e.key === 'Enter') handleAddCategory() }}
                    />
                    <button
                        className="btn btn-sm btn-primary"
                        onClick={handleAddCategory}
                        disabled={!newCategoryName.trim()}
                    >
                        {t('add')}
                    </button>
                </div>
            </div>

            <div className="sp-settings-section">
                <h5 className="sp-settings-section-title">
                    {t('symbol_palette_symbols_in_category', { category: selectedCategoryId })}
                </h5>
                <div className="sp-settings-table-container">
                    <table className="sp-settings-table">
                        <thead>
                            <tr>
                                <th className="sp-settings-th sp-settings-th-symbol">{t('symbol')}</th>
                                <th className="sp-settings-th">{t('symbol_palette_latex_command')}</th>
                                <th className="sp-settings-th">{t('symbol_palette_tooltip')}</th>
                                <th className="sp-settings-th sp-settings-th-actions">{t('symbol_palette_actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categorySymbols.map((symbol, idx) => (
                                <SymbolRow
                                    key={symbol.codepoint}
                                    symbol={symbol}
                                    onUpdate={updateSymbol}
                                    onRemove={removeSymbol}
                                    onMoveUp={handleMoveUp}
                                    onMoveDown={handleMoveDown}
                                    isFirst={idx === 0}
                                    isLast={idx === categorySymbols.length - 1}
                                />
                            ))}
                            <AddSymbolForm
                                categoryId={selectedCategoryId}
                                onAdd={addSymbol}
                            />
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="sp-settings-section sp-settings-buttons">
                <button className="btn btn-danger" onClick={handleReset}>
                    {t('symbol_palette_reset_defaults')}
                </button>
                <button className="btn btn-secondary" onClick={handleExport}>
                    {t('symbol_palette_export')}
                </button>
                <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                    {t('symbol_palette_import')}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleImport}
                />
            </div>
        </div>
    )
}
