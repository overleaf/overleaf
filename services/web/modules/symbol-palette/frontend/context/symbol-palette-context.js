import { createContext, useCallback, useContext, useMemo, useState, useEffect, useRef } from 'react'
import defaultSymbols from '../data/symbols.json'
import { createCategories } from '../utils/categories'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'ol-symbol-palette-user-config'

function loadUserConfig() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.symbols)) {
                return parsed
            }
        }
    } catch {
        // ignore
    }
    return null
}

const SYNC_EVENT = 'symbol-palette-config-changed'

function saveUserConfig(config) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
        window.dispatchEvent(new CustomEvent(SYNC_EVENT))
    } catch {
        // ignore
    }
}

function getDefaultConfig(t) {
    const cats = createCategories(t)
    return {
        categories: cats.map(c => c.id),
        symbols: defaultSymbols.map(s => ({ ...s })),
    }
}

const SymbolPaletteConfigContext = createContext(undefined)

export function SymbolPaletteConfigProvider({ children }) {
    const { t } = useTranslation()

    const defaultConfig = useMemo(() => getDefaultConfig(t), [t])

    const [config, setConfig] = useState(() => {
        return loadUserConfig() || defaultConfig
    })

    // isExternalUpdate: when true the config change came from storage sync,
    // so we already have the latest value persisted — skip save + dispatch.
    const isSaving = useRef(false)
    const isExternalUpdate = useRef(false)
    useEffect(() => {
        if (isExternalUpdate.current) {
            isExternalUpdate.current = false
            return
        }
        isSaving.current = true
        saveUserConfig(config)
        isSaving.current = false
    }, [config])

    // Sync state when another provider instance saves
    useEffect(() => {
        function handleExternalChange() {
            if (isSaving.current) return
            const updated = loadUserConfig()
            if (updated) {
                isExternalUpdate.current = true
                setConfig(updated)
            }
        }
        window.addEventListener(SYNC_EVENT, handleExternalChange)
        return () => window.removeEventListener(SYNC_EVENT, handleExternalChange)
    }, [])

    const categories = useMemo(() => {
        const defaultCats = createCategories(t)
        return config.categories.map(id => {
            const found = defaultCats.find(c => c.id === id)
            return found || { id, label: id }
        })
    }, [config.categories, t])

    const symbols = config.symbols

    const addCategory = useCallback((categoryId) => {
        setConfig(prev => {
            if (prev.categories.includes(categoryId)) return prev
            return { ...prev, categories: [...prev.categories, categoryId] }
        })
    }, [])

    const removeCategory = useCallback((categoryId) => {
        setConfig(prev => ({
            ...prev,
            categories: prev.categories.filter(id => id !== categoryId),
            symbols: prev.symbols.filter(s => s.category !== categoryId),
        }))
    }, [])

    const renameCategory = useCallback((oldId, newId) => {
        setConfig(prev => ({
            ...prev,
            categories: prev.categories.map(id => id === oldId ? newId : id),
            symbols: prev.symbols.map(s => s.category === oldId ? { ...s, category: newId } : s),
        }))
    }, [])

    const reorderCategories = useCallback((newOrder) => {
        setConfig(prev => ({ ...prev, categories: newOrder }))
    }, [])

    const addSymbol = useCallback((symbol) => {
        setConfig(prev => {
            // guarantee a unique codepoint (it is used as the identity key)
            const existing = new Set(prev.symbols.map(s => s.codepoint))
            let codepoint = symbol.codepoint
            let n = 2
            while (existing.has(codepoint)) {
                codepoint = `${symbol.codepoint}-${n}`
                n++
            }
            return {
                ...prev,
                symbols: [...prev.symbols, { ...symbol, codepoint }],
            }
        })
    }, [])

    const removeSymbol = useCallback((codepoint) => {
        setConfig(prev => ({
            ...prev,
            symbols: prev.symbols.filter(s => s.codepoint !== codepoint),
        }))
    }, [])

    const updateSymbol = useCallback((codepoint, updates) => {
        setConfig(prev => ({
            ...prev,
            symbols: prev.symbols.map(s =>
                s.codepoint === codepoint ? { ...s, ...updates } : s
            ),
        }))
    }, [])

    const reorderSymbols = useCallback((categoryId, newSymbols) => {
        setConfig(prev => ({
            ...prev,
            symbols: [
                ...prev.symbols.filter(s => s.category !== categoryId),
                ...newSymbols,
            ],
        }))
    }, [])

    const resetToDefaults = useCallback(() => {
        const def = getDefaultConfig(t)
        setConfig(def)
    }, [t])

    const exportConfig = useCallback(() => {
        return JSON.stringify(config, null, 2)
    }, [config])

    const importConfig = useCallback((jsonString) => {
        try {
            const parsed = JSON.parse(jsonString)
            if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.symbols)) {
                return false
            }
            const categories = parsed.categories.filter(
                c => typeof c === 'string' && c.trim() !== ''
            )
            if (categories.length === 0) {
                return false
            }
            // sanitize + dedupe symbols (codepoint is the identity key)
            const symbols = []
            const seen = new Set()
            for (const s of parsed.symbols) {
                if (!s || typeof s !== 'object') continue
                if (typeof s.command !== 'string' || s.command.trim() === '') continue
                if (typeof s.codepoint !== 'string' || s.codepoint === '') continue
                if (seen.has(s.codepoint)) continue
                seen.add(s.codepoint)
                symbols.push({
                    command: s.command,
                    codepoint: s.codepoint,
                    category: typeof s.category === 'string' ? s.category : '',
                    description: typeof s.description === 'string' ? s.description : '',
                    character: typeof s.character === 'string' ? s.character : '',
                    aliases: Array.isArray(s.aliases)
                        ? s.aliases.filter(a => typeof a === 'string')
                        : [],
                    notes: typeof s.notes === 'string' ? s.notes : '',
                })
            }
            setConfig({ categories, symbols })
            return true
        } catch {
            // ignore
        }
        return false
    }, [])

    const value = useMemo(() => ({
        categories,
        symbols,
        addCategory,
        removeCategory,
        renameCategory,
        reorderCategories,
        addSymbol,
        removeSymbol,
        updateSymbol,
        reorderSymbols,
        resetToDefaults,
        exportConfig,
        importConfig,
        config,
    }), [
        categories,
        symbols,
        addCategory,
        removeCategory,
        renameCategory,
        reorderCategories,
        addSymbol,
        removeSymbol,
        updateSymbol,
        reorderSymbols,
        resetToDefaults,
        exportConfig,
        importConfig,
        config,
    ])

    return (
        <SymbolPaletteConfigContext.Provider value={value}>
            {children}
        </SymbolPaletteConfigContext.Provider>
    )
}

export function useSymbolPaletteConfig() {
    const context = useContext(SymbolPaletteConfigContext)
    if (!context) {
        throw new Error('useSymbolPaletteConfig must be used within SymbolPaletteConfigProvider')
    }
    return context
}
