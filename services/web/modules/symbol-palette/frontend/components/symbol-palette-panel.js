import RailPanelHeader from '@/features/ide-react/components/rail/rail-panel-header'
import { useTranslation } from 'react-i18next'
import SymbolPaletteContent from './symbol-palette-content'
import { SymbolPaletteConfigProvider } from '../context/symbol-palette-context'

export default function SymbolPalettePanel() {
    const { t } = useTranslation()

    const handleSelect = (symbol) => {
        window.dispatchEvent(new CustomEvent('editor:insert-symbol', { detail: symbol }))
    }

    return (
        <SymbolPaletteConfigProvider>
            <div className="symbol-palette-rail-panel">
                <RailPanelHeader title={t('symbol_palette')} />
                <div className="symbol-palette-rail-panel-body">
                    <SymbolPaletteContent handleSelect={handleSelect} />
                </div>
            </div>
        </SymbolPaletteConfigProvider>
    )
}
