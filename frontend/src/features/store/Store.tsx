import { useEffect, useState } from 'react';
import type { GameCatalog } from '@game/contracts';
import { api, ApiError } from '../../api';
import { CharacterArt } from '../characters/CharacterArt';
import { CharacterDetails } from '../characters/CharacterList';
import { useI18n } from '../../i18n/LanguageProvider';
import { premiumUnitPrices } from '@game/content/unlocks';
import '../characters/characters.css';
import './store.css';

const storeUnitIds = ['legendary-beast-premium', 'rival-b-final-mode'];

interface StoreProps {
  onBack: () => void;
  onSessionExpired: () => void;
}

export function Store({ onBack, onSessionExpired }: StoreProps) {
  const { t, text, currency } = useI18n();
  const [catalog, setCatalog] = useState<GameCatalog | null>(null);
  const [unlockedUnitIds, setUnlockedUnitIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [charactersOpen, setCharactersOpen] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError('');
    setCatalog(null);
    setUnlockedUnitIds(new Set());
    Promise.all([api.catalog(), api.progress()])
      .then(([content, progress]) => {
        if (!active) return;
        setCatalog(content);
        setUnlockedUnitIds(new Set(progress.unlockedUnitIds));
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
        setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a loja.');
      });
    return () => { active = false; };
  }, [attempt, onSessionExpired]);

  const items = storeUnitIds
    .map((id) => catalog?.units.find((unit) => unit.id === id))
    .filter((unit) => unit !== undefined);
  const selected = items.find((unit) => unit.id === selectedId);
  const selectedUnlocked = !!selected && unlockedUnitIds.has(selected.id);

  return (
    <main className="roster-page store-page">
      <header className="roster-header">
        <button type="button" className="back-arrow" onClick={onBack} aria-label={t('Voltar ao menu principal')}>
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M14 6 4 16l10 10M5 16h23" />
          </svg>
        </button>
        <h1>{t('Loja')}</h1>
      </header>

      {error ? (
        <section className="roster-state">
          <p role="alert">{text(error)}</p>
          <button className="fantasy-button compact" onClick={() => setAttempt((value) => value + 1)}>{t('Tentar novamente')}</button>
        </section>
      ) : !catalog ? <p className="roster-state" role="status">{t('Carregando loja.')}</p> : (
        <div className="store-layout">
          <nav className="store-menu" aria-label={t('Categorias da loja')}>
            <button type="button" className="menu-option" aria-expanded={charactersOpen}
              onClick={() => setCharactersOpen((open) => !open)}>{t('Personagens')}</button>
            {charactersOpen && (
              <div className="store-submenu" role="group" aria-label={t('Personagens disponíveis')}>
                {items.map((unit) => (
                  <button type="button" className={`menu-option store-item ${selectedId === unit.id ? 'store-item--selected' : ''}`}
                    key={unit.id} aria-pressed={selectedId === unit.id} onClick={() => setSelectedId(unit.id)}>
                    <CharacterArt unit={unit} face />
                    <span>{text(unit.name)}</span>
                  </button>
                ))}
              </div>
            )}
          </nav>

          {selected && <CharacterDetails unit={selected} catalog={catalog} unlocked={selectedUnlocked} showLock={false} busy={false}
            onAdd={() => {}} purchaseLabel={selectedUnlocked ? t('Personagem adquirido') : t('Adquirir por {price}', { price: currency(premiumUnitPrices[selected.id]) })} />}
        </div>
      )}
    </main>
  );
}
