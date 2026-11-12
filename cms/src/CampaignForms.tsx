import type { Campaign, Catalog, Encounter } from '../contracts';
import { encounterOptions } from './CharacterForm';
import { DEFAULT_CAMPAIGN_MAP } from '../../shared/src/content/campaigns';
import { ImageField, NumberField, Select, Text } from './fields';

export function CampaignForm({ value: c, onChange, catalog, openEncounter, createEncounter }: {
  value: Campaign; onChange: (value: Campaign) => void; catalog: Catalog; openEncounter: (value: Encounter) => void; createEncounter: () => void;
}) {
  const update = (patch: Partial<Campaign>) => onChange({ ...c, ...patch });
  return <>
    <section className="form-section"><div className="section-heading"><span>01</span><h3>Metadados</h3></div>
      <Text label="Título da campanha" value={c.title} onChange={(title) => update({ title })} />
      <Text label="Descrição da campanha" multiline value={c.description} onChange={(description) => update({ description })} />
      <div className="form-grid"><NumberField label="Número do capítulo" min={1} value={c.chapterNumber} onChange={(chapterNumber) => update({ chapterNumber })} />
        <NumberField label="Ordem na seleção" value={c.sortOrder} onChange={(sortOrder) => update({ sortOrder })} /></div>
      <div className="form-grid"><ImageField label="Imagem principal (card)" value={c.background} onChange={(background) => update({ background })} />
        <ImageField label="Imagem de fundo (mapa)" value={c.mapBackground ?? ''} onChange={(mapBackground) => update({ mapBackground: mapBackground || null })} /></div>
      <Select label="Confronto necessário para liberar a campanha" value={c.prerequisiteEncounterId ?? ''} empty="Sem requisito adicional" options={encounterOptions(catalog).filter((e) => !catalog.encounters.some((item) => item.id === e.id && item.campaignId === c.id))} onChange={(id) => update({ prerequisiteEncounterId: id || null })} />
      <p className="muted">A descrição aparece no pergaminho do mapa. Campanhas publicadas ficam disponíveis, respeitando apenas o confronto necessário selecionado acima.</p>
      <label className="check"><input type="checkbox" checked={c.released} onChange={(e) => update({ released: e.target.checked })} />Campanha publicada / disponível no jogo</label>
    </section>
    <section className="form-section"><div className="section-heading"><span>02</span><h3>Confrontos da campanha</h3></div>
      <div className="encounter-list">{catalog.encounters.filter((e) => e.campaignId === c.id).map((encounter) => <button type="button" key={encounter.id} onClick={() => openEncounter(encounter)}>
        <span className="battle-number">{String(encounter.position).padStart(2, '0')}</span><span><strong>{encounter.title}</strong><small>{encounter.enemyUnitIds.map((id) => catalog.characters.find((u) => u.id === id)?.name ?? id).join(' · ')}</small></span><span aria-hidden="true">↗</span>
      </button>)}</div>
      <button type="button" className="secondary" disabled={!catalog.campaigns.some((item) => item.id === c.id)} onClick={createEncounter}>+ Adicionar confronto</button>
      {!catalog.campaigns.some((item) => item.id === c.id) && <p className="muted">Salve a campanha para cadastrar seus confrontos.</p>}
    </section>
  </>;
}
export function EncounterForm({ value: e, onChange, catalog, existing }: { value: Encounter; onChange: (value: Encounter) => void; catalog: Catalog; existing: boolean }) {
  const update = (patch: Partial<Encounter>) => onChange({ ...e, ...patch });
  return <section className="form-section"><div className="section-heading"><span>01</span><h3>Configuração do confronto</h3></div>
    <div className="form-grid"><Select label="Campanha" value={e.campaignId} options={catalog.campaigns.map((c) => ({ id: c.id, name: c.title }))} disabled={existing} onChange={(campaignId) => update({ campaignId, position: catalog.encounters.filter((item) => item.campaignId === campaignId).length + 1 })} />
      <NumberField label="Posição da batalha" min={1} max={catalog.encounters.filter((item) => item.campaignId === e.campaignId && item.id !== e.id).length + 1} value={e.position} onChange={(position) => update({ position })} /></div>
    <p className="muted">Ao mudar a posição, os outros confrontos são reordenados automaticamente, preservando seus IDs e o progresso dos jogadores.</p>
    <Text label="Título do confronto" value={e.title} onChange={(title) => update({ title })} /><Text label="História / descrição" multiline value={e.story} onChange={(story) => update({ story })} />
    <h4>Equipe adversária</h4><div className="form-grid">{Array.from({ length: 3 }, (_, slot) => <Select key={slot} label={`Inimigo · slot ${slot + 1}`} value={e.enemyUnitIds[slot] ?? ''} empty={slot ? 'Slot vazio' : 'Escolha o primeiro inimigo'} options={catalog.characters} onChange={(unitId) => {
      const ids = [...e.enemyUnitIds]; ids[slot] = unitId; update({ enemyUnitIds: ids.filter(Boolean) });
    }} />)}</div>
    <h4>Posição no mapa</h4><div className="form-grid"><NumberField label="Horizontal · X (%)" min={0} max={100} step={0.1} value={e.mapX} onChange={(mapX) => update({ mapX })} /><NumberField label="Vertical · Y (%)" min={0} max={100} step={0.1} value={e.mapY} onChange={(mapY) => update({ mapY })} /></div>
    <div className="map-preview" style={{ backgroundImage: `url("${catalog.campaigns.find((c) => c.id === e.campaignId)?.mapBackground ?? DEFAULT_CAMPAIGN_MAP}")` }}>
      <span style={{ left: `${e.mapX}%`, top: `${e.mapY}%` }}>{e.position}</span>
    </div>
  </section>;
}
