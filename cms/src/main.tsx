import { StrictMode, useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { AbilityDefinition } from '../../shared/src/content/abilities';
import { DEFAULT_CAMPAIGN_MAP } from '../../shared/src/content/campaigns';
import type { Campaign, Catalog, Character, Encounter, Entity, Status } from '../contracts';
import { request, setToken } from './api';
import { CharacterForm } from './CharacterForm';
import { CampaignForm, EncounterForm } from './CampaignForms';
import { AbilityForm } from './AbilityForm';
import { Text, UploadActivity } from './fields';
import './studio.css';

type Draft = Character | AbilityDefinition | Campaign | Encounter;
const empty: Catalog = { characters: [], abilities: [], campaigns: [], encounters: [], setups: [] };
const navigation: { id: Entity; name: string; singular: string; icon: string; description: string }[] = [
  { id: 'characters', name: 'Personagens', singular: 'personagem', icon: '♙', description: 'Dê vida aos protagonistas, rivais e encontros desta jornada.' },
  { id: 'abilities', name: 'Habilidades', singular: 'habilidade', icon: '✧', description: 'Transforme ideias em estratégias e efeitos de combate.' },
  { id: 'campaigns', name: 'Campanhas', singular: 'campanha', icon: '⚑', description: 'Construa os capítulos, os cenários e os desafios da aventura.' },
  { id: 'encounters', name: 'Confrontos', singular: 'confronto', icon: '⚔', description: 'Organize cada batalha e as equipes que esperam pelo jogador.' },
];
function title(draft: Draft) { return 'name' in draft ? draft.name : draft.title; }
function thumbnail(draft: Draft) { return 'portrait' in draft ? draft.portrait : 'icon' in draft ? draft.icon : 'background' in draft ? draft.background : null; }
function createDraft(entity: Entity, catalog: Catalog, campaignId?: string): Draft {
  if (entity === 'characters') return { id: '', characterId: '', name: '', version: 'Base', description: '', maxHp: 100, portrait: '', illustration: '',
    abilityIds: catalog.abilities.slice(0, 4).map((a) => a.id), unlock: { kind: 'battle-wins', description: 'Complete os requisitos para desbloquear.' },
    unlockRule: { unitId: '', description: 'Vença 5 batalhas rápidas.', availableFromStart: true, requirements: [{ kind: 'battle-wins', mode: 'quick', target: 5, description: 'Vença 5 batalhas rápidas.' }] },
    priceUsd: null, rosterOrder: null };
  if (entity === 'abilities') return { id: '', name: '', description: '', icon: '', energyCost: 15, target: 'enemy', effects: [{ kind: 'damage', amount: 20 }] };
  if (entity === 'campaigns') return { id: '', title: '', description: '', chapterNumber: Math.max(0, ...catalog.campaigns.map((c) => c.chapterNumber)) + 1,
    sortOrder: Math.max(-1, ...catalog.campaigns.map((c) => c.sortOrder)) + 1, background: '', mapBackground: DEFAULT_CAMPAIGN_MAP, prerequisiteEncounterId: null, released: false };
  const campaign = campaignId ?? catalog.campaigns[0]?.id ?? '';
  return { id: '', campaignId: campaign, position: catalog.encounters.filter((e) => e.campaignId === campaign).length + 1, title: '', story: '', mapX: 50, mapY: 50,
    enemyUnitIds: [] };
}

export function Studio() {
  const [status, setStatus] = useState<Status | null>(null);
  const [catalog, setCatalog] = useState<Catalog>(empty);
  const [entity, setEntity] = useState<Entity>('characters');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [existing, setExisting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = navigation.find((item) => item.id === entity)!;
  async function reload() { setCatalog(await request<Catalog>('/api/catalog')); }
  async function connect() {
    setLoading(true); setError('');
    try {
      const result = await request<Status>('/api/status'); setToken(result.token); setStatus(result);
      if (result.ready) await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível conectar à API local.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void connect(); }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function canNavigate() {
    if (busy || uploads > 0) { setError('Aguarde a operação em andamento antes de abrir outro conteúdo.'); return false; }
    if (!dirty) return true;
    setError('Você tem alterações no rascunho. Salve ou descarte antes de abrir outro conteúdo.'); return false;
  }
  function open(item: Draft, target = entity, isExisting = true) {
    if (!canNavigate()) return;
    setEntity(target); setDraft(structuredClone(item)); setExisting(isExisting); setDirty(false); setError(''); setNotice('');
    setTimeout(() => heading.current?.focus(), 0);
  }
  function update(item: Draft) { setDraft(item); setDirty(true); setNotice(''); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft || busy || uploads > 0) return;
    if (!window.confirm(`Confirmar ${existing ? 'as alterações em' : 'a criação de'} “${title(draft)}”?`)) return;
    setBusy(true); setError(''); setNotice('');
    let saved = false;
    try {
      await request(`/api/${entity}${existing ? `/${draft.id}` : ''}`, existing ? 'PUT' : 'POST', draft);
      saved = true; setDirty(false); setExisting(true); await reload(); setNotice('Alterações salvas no banco com sucesso.');
    } catch (cause) { setError(`${saved ? 'Conteúdo salvo, mas a atualização da lista falhou. ' : ''}${cause instanceof Error ? cause.message : 'Não foi possível salvar.'}`); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!draft || !existing || busy) return;
    if (!window.confirm(`Excluir “${title(draft)}” permanentemente?`)) return;
    setBusy(true); setError('');
    try { await request(`/api/${entity}/${draft.id}`, 'DELETE'); setDraft(null); setDirty(false); await reload(); setNotice('Registro excluído.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível excluir.'); }
    finally { setBusy(false); }
  }
  async function moveCharacter(id: string, direction: -1 | 1) {
    if (!canNavigate()) return;
    const ids = catalog.characters.map((c) => c.id);
    const index = ids.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(true); setError(''); setNotice('');
    try {
      await request('/api/characters/order', 'PUT', { ids });
      await reload(); setNotice('Ordem dos personagens atualizada no jogo.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível reordenar.'); }
    finally { setBusy(false); }
  }
  const records = (catalog[entity] as Draft[]).filter((item) => `${title(item)} ${item.id}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return <div className="studio">
    <aside className="sidebar"><a className="brand" href="/" aria-label="Rave Trail Content Studio"><span className="brand-mark">R<span>✦</span></span><span>RAVE TRAIL<small>CONTENT STUDIO</small></span></a>
      <div className="workspace-label">ESPAÇO DE CRIAÇÃO <span>LOCAL</span></div><nav aria-label="Conteúdo do jogo">{navigation.map((item) => <button type="button" key={item.id} aria-current={entity === item.id ? 'page' : undefined} onClick={() => {
        if (!canNavigate()) return; setEntity(item.id); setDraft(null); setSearch(''); setError(''); setNotice('');
      }}><span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.name}<span className="nav-count">{catalog[item.id].length}</span></button>)}</nav>
      <div className="sidebar-bottom"><span className="tiny-label">CONEXÃO ATIVA</span><div className="connection"><i className={status?.ready ? 'online' : ''} /><strong>{status?.database ?? 'Aguardando API'}</strong></div><p>Seu estúdio roda nesta máquina.<br />O conteúdo vive no banco conectado.</p><button type="button" className="text-button" disabled={loading || busy} onClick={() => { void connect(); }}>↻ Verificar conexão</button></div>
    </aside>
    <main className="workspace"><header className="topbar"><span>Estúdio <span className="slash">/</span> <strong>{selected.name}</strong></span><span className="local-badge"><i /> Ambiente local</span></header>
      <div className="page-heading"><div><p className="eyebrow">O PRÓXIMO CAPÍTULO COMEÇA AQUI</p><h1>{selected.name}<span>.</span></h1><p>{selected.description}</p></div><button type="button" className="primary" disabled={!status?.ready || busy || loading} onClick={() => open(createDraft(entity, catalog), entity, false)}>+ {entity === 'abilities' || entity === 'campaigns' ? 'Nova' : 'Novo'} {selected.singular}</button></div>
      {!status?.ready && !loading && <section className="connection-card"><span className="connection-icon" aria-hidden="true">⌁</span><div><h2>Conecte seu banco para começar</h2><p>{status?.message ?? 'Inicie a API local com npm run cms:local ou npm run cms:prod.'}</p><ol><li>Preencha <code>.env.cms.local</code> ou <code>.env.cms.prod</code> com a conexão do perfil escolhido.</li><li>Para Lightsail, execute <code>npm run cms:prod:tunnel</code> em outro terminal.</li><li>Prepare o banco com <code>npm run cms:local:db:setup</code> ou <code>npm run cms:prod:db:setup</code>.</li></ol><button type="button" className="secondary" onClick={() => { void connect(); }}>Verificar conexão</button></div></section>}
      <div className="messages">{error && <p className="error" role="alert">{error}</p>}{notice && <p className="success" role="status">{notice}</p>}{loading && <p className="muted" role="status">Carregando conexão e conteúdo…</p>}</div>
      {status?.ready && <div className={`content-layout ${draft ? 'has-editor' : ''}`}>
        <section className="library" aria-label={`Lista de ${selected.name.toLowerCase()}`}><div className="library-toolbar"><label className="search"><span aria-hidden="true">⌕</span><input type="search" aria-label={`Buscar ${selected.name.toLowerCase()}`} placeholder="Buscar por nome ou ID…" value={search} onChange={(e) => setSearch(e.target.value)} /></label><span>{records.length} registros</span></div>
          {records.length === 0 ? <div className="empty-state"><span aria-hidden="true">{selected.icon}</span><h2>{search ? 'Nenhum resultado' : 'Uma página em branco'}</h2><p>{search ? 'Tente outro nome ou ID.' : `Crie o primeiro registro de ${selected.name.toLowerCase()}.`}</p></div>
            : <div className={`record-list ${entity === 'characters' ? 'character-records' : ''}`}>{records.map((record) => <div className="record-row" key={record.id}><button type="button" className={`record ${existing && record.id === draft?.id ? 'selected' : ''}`} aria-pressed={existing && record.id === draft?.id} onClick={() => open(record)}>
              <div className={`record-image ${entity}`}>{thumbnail(record) ? <img src={thumbnail(record)!} alt="" loading="lazy" /> : <span aria-hidden="true">{entity === 'encounters' && 'position' in record ? String(record.position).padStart(2, '0') : selected.icon}</span>}</div>
              <div className="record-info"><strong>{title(record)}</strong><small>{record.id}</small><span className="record-meta">{'maxHp' in record ? `${record.maxHp} HP · ${record.abilityIds.length} habilidades` : 'energyCost' in record ? `${record.energyCost} energia · ${record.effects.length} efeito(s)` : 'chapterNumber' in record ? `Capítulo ${record.chapterNumber} · ${record.released ? 'Publicada' : 'Rascunho'}` : `Batalha ${record.position} · ${catalog.campaigns.find((c) => c.id === record.campaignId)?.title ?? record.campaignId}`}</span></div><span className="record-arrow" aria-hidden="true">↗</span>
            </button>{entity === 'characters' && <div className="record-order" role="group" aria-label={`Ordem de ${title(record)}`}><span>{catalog.characters.findIndex((c) => c.id === record.id) + 1}</span>
              <button type="button" className="icon-button" aria-label={`Subir ${title(record)}`} disabled={busy || uploads > 0 || dirty || record.id === catalog.characters[0]?.id} onClick={() => { void moveCharacter(record.id, -1); }}>↑</button>
              <button type="button" className="icon-button" aria-label={`Descer ${title(record)}`} disabled={busy || uploads > 0 || dirty || record.id === catalog.characters.at(-1)?.id} onClick={() => { void moveCharacter(record.id, 1); }}>↓</button>
            </div>}</div>)}</div>}
          <footer className="library-footer"><i /> {status.database} · conteúdo persistido</footer>
        </section>
        {draft && <section key={`${entity}:${existing ? draft.id : 'new'}`} className="editor" aria-label={`Editor de ${selected.singular}`}><div className="editor-heading"><div><p className="eyebrow">{existing ? 'EDITANDO CONTEÚDO' : 'NOVO CONTEÚDO'}</p><h2 ref={heading} tabIndex={-1}>{title(draft) || `Novo registro de ${selected.singular}`}</h2></div><button type="button" className="icon-button" aria-label="Fechar editor" disabled={busy} onClick={() => { if (canNavigate()) setDraft(null); }}>×</button></div>
          <form onSubmit={(e) => { void save(e); }}><UploadActivity.Provider value={(active) => setUploads((count) => Math.max(0, count + (active ? 1 : -1)))}><fieldset className="editor-fields" disabled={busy}>
            <div className="identity"><Text label="ID único" value={draft.id} disabled={existing} hint="Minúsculas, números e hífens. O ID não muda após salvar." onChange={(id) => {
              if ('unlockRule' in draft) update({ ...draft, id, unlockRule: draft.unlockRule ? { ...draft.unlockRule, unitId: id } : null }); else update({ ...draft, id });
            }} /></div>
            {entity === 'characters' && <CharacterForm value={draft as Character} onChange={update} catalog={catalog} />}
            {entity === 'abilities' && <AbilityForm value={draft as AbilityDefinition} onChange={update} catalog={catalog} aiReady={status.aiReady} />}
            {entity === 'campaigns' && <CampaignForm value={draft as Campaign} onChange={update} catalog={catalog} openEncounter={(e) => open(e, 'encounters')} createEncounter={() => open(createDraft('encounters', catalog, draft.id), 'encounters', false)} />}
            {entity === 'encounters' && <EncounterForm value={draft as Encounter} onChange={update} catalog={catalog} existing={existing} />}
          </fieldset></UploadActivity.Provider><div className="save-bar"><span className="draft-state"><i className={dirty ? 'unsaved' : ''} />{uploads ? 'Enviando imagem…' : dirty ? 'Alterações não salvas' : existing ? 'Sincronizado com o banco' : 'Novo rascunho'}</span><div>
            {dirty && <button type="button" className="text-button" disabled={busy || uploads > 0} onClick={() => { if (!window.confirm('Descartar todas as alterações não salvas?')) return; setDraft(existing ? structuredClone((catalog[entity] as Draft[]).find((r) => r.id === draft.id) ?? draft) : null); setDirty(false); setError(''); }}>Descartar</button>}
            {existing && <button type="button" className="text-button danger" disabled={busy || uploads > 0} onClick={() => { void remove(); }}>Excluir</button>}
            <button type="submit" className="primary" disabled={busy || uploads > 0 || existing && !dirty}>{busy ? 'Salvando…' : 'Salvar alterações'}</button></div></div></form>
        </section>}
      </div>}
      <footer className="page-footer"><span>RAVE TRAIL <span>✦</span> CONTENT STUDIO</span><span>Feito para construir mundos.</span></footer>
    </main>
  </div>;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><Studio /></StrictMode>);
