import type { Catalog, Character } from '../contracts';
import type { UnlockRequirement, BattleUnlockRule } from '../../shared/src/content/unlocks';
import { ImageField, MultiSelect, NumberField, Select, Text } from './fields';
import { AbilityPicker } from './AbilityPicker';

export function encounterOptions(catalog: Catalog) {
  return catalog.encounters.map((e) => ({ id: e.id, name: `${catalog.campaigns.find((c) => c.id === e.campaignId)?.title ?? e.campaignId} · Batalha ${e.position}: ${e.title}` }));
}
export function CharacterForm({ value: c, onChange, catalog }: { value: Character; onChange: (value: Character) => void; catalog: Catalog }) {
  const update = (patch: Partial<Character>) => onChange({ ...c, ...patch });
  const rule: BattleUnlockRule = c.unlockRule ?? { unitId: c.id, description: c.unlock.description, requirements: [], availableFromStart: true };
  const updateRule = (patch: Partial<BattleUnlockRule>) => {
    const next = { ...rule, ...patch, unitId: c.id };
    const description = next.requirements.map((r) => r.description).join(' ') || 'Complete os requisitos para desbloquear.';
    update({ unlockRule: { ...next, description }, unlock: { kind: 'battle-wins', description } });
  };
  const requirements = rule.requirements;
  const gateCampaign = catalog.encounters.find((e) => e.id === rule.availableAfterEncounterId)?.campaignId ?? '';
  function changeRequirement(index: number, value: UnlockRequirement) {
    updateRule({ requirements: requirements.map((r, i) => i === index ? value : r) });
  }
  return <>
    <section className="form-section"><div className="section-heading"><span>01</span><h3>Identidade do personagem</h3></div>
      <div className="form-grid"><Text label="Nome" value={c.name} onChange={(name) => update({ name })} /><Text label="Versão" value={c.version} onChange={(version) => update({ version })} />
        <Text label="ID do personagem narrativo" value={c.characterId} onChange={(characterId) => update({ characterId })} hint="Versões da mesma pessoa podem compartilhar este ID." />
        <NumberField label="HP máximo" value={c.maxHp} min={1} max={10000} onChange={(maxHp) => update({ maxHp })} /></div>
      <Text label="Descrição" multiline value={c.description} onChange={(description) => update({ description })} />
      <div className="form-grid"><ImageField label="Imagem de rosto" value={c.portrait} onChange={(portrait) => update({ portrait })} /><ImageField label="Imagem de corpo" value={c.illustration} onChange={(illustration) => update({ illustration })} /></div>
    </section>
    <section className="form-section"><div className="section-heading"><span>02</span><h3>Leque de habilidades</h3></div><p className="muted">Quatro habilidades distintas, na ordem em que aparecem no jogo.</p>
      {Array.from({ length: 4 }, (_, index) => <AbilityPicker key={index} index={index} value={c.abilityIds[index] ?? ''}
        abilities={catalog.abilities} onChange={(id) => update({ abilityIds: Array.from({ length: 4 }, (_, i) => i === index ? id : c.abilityIds[i] ?? '') })} />)}
    </section>
    <section className="form-section"><div className="section-heading"><span>03</span><h3>Desbloqueio e requisitos</h3></div>
      <Select label="Forma de desbloqueio" value={c.unlock.kind} options={[
        { id: 'starter', name: 'Disponível desde o início' }, { id: 'premium', name: 'Premium (aquisição desabilitada no jogo)' }, { id: 'battle-wins', name: 'Missão com requisitos' },
      ]} onChange={(kind) => update({ unlock: { kind: kind as Character['unlock']['kind'], description: kind === 'starter' ? 'Disponível desde o início da jornada.' : kind === 'premium' ? 'Personagem premium.' : rule.description }, unlockRule: kind === 'battle-wins' ? rule : null,
        priceUsd: kind === 'premium' ? c.priceUsd ?? 9.9 : null })} />
      {c.unlock.kind === 'premium' && <NumberField label="Preço em USD" min={0.01} step={0.01} max={10000} value={c.priceUsd ?? 9.9} onChange={(priceUsd) => update({ priceUsd })} />}
      {c.unlock.kind === 'battle-wins' && <>
        <Select label="Quando revelar a lista de requisitos" value={rule.availableFromStart ? 'start' : 'encounter'} options={[
          { id: 'start', name: 'Desde o início' }, { id: 'encounter', name: 'Após vencer uma batalha específica de uma campanha' },
        ]} onChange={(kind) => {
          const { availableAfterEncounterId: _gate, availableFromStart: _start, ...rest } = rule;
          update({ unlockRule: { ...rest, unitId: c.id, ...(kind === 'start' ? { availableFromStart: true } : { availableAfterEncounterId: catalog.encounters[0]?.id ?? '' }) } });
        }} />
        {!rule.availableFromStart && <div className="form-grid"><Select label="Campanha para revelar requisitos" value={gateCampaign} options={catalog.campaigns.map((c) => ({ id: c.id, name: c.title }))} empty="Escolha a campanha" onChange={(campaignId) => updateRule({ availableAfterEncounterId: catalog.encounters.find((e) => e.campaignId === campaignId)?.id ?? '' })} />
          <Select label="Batalha mínima para revelar requisitos" value={rule.availableAfterEncounterId ?? ''} options={encounterOptions(catalog).filter((e) => catalog.encounters.some((item) => item.id === e.id && item.campaignId === gateCampaign))} empty="Escolha o confronto" onChange={(availableAfterEncounterId) => updateRule({ availableAfterEncounterId })} /></div>}
        <p className="callout">Todos os requisitos abaixo devem ser cumpridos. Vitórias contam após a revelação da missão; desbloqueios já conquistados são preservados.</p>
        {requirements.map((r, index) => <fieldset className="requirement" key={index}><legend>Requisito {index + 1}</legend>
          <div className="row"><Select label="Tipo de requisito" value={r.kind} options={[{ id: 'battle-wins', name: 'Vitórias em batalhas' }, { id: 'encounter', name: 'Finalizar confronto da campanha' }]} onChange={(kind) => changeRequirement(index, kind === 'encounter'
            ? { kind: 'encounter', encounterId: catalog.encounters[0]?.id ?? '', target: 1, description: 'Finalize a batalha indicada.' }
            : { kind: 'battle-wins', mode: 'quick', target: 5, description: 'Vença 5 batalhas rápidas.' })} />
            <button type="button" className="text-button danger" onClick={() => { if (window.confirm(`Remover o requisito ${index + 1}?`)) updateRule({ requirements: requirements.filter((_, i) => i !== index) }); }}>Remover requisito</button></div>
          <Text label={`Descrição do requisito ${index + 1}`} value={r.description} onChange={(description) => changeRequirement(index, { ...r, description })} />
          {r.kind === 'encounter' ? <Select label="Confronto a finalizar" value={r.encounterId} options={encounterOptions(catalog)} empty="Escolha o confronto" onChange={(encounterId) => changeRequirement(index, { ...r, encounterId })} /> : <>
            <div className="form-grid"><Select label="Modo de batalha" value={r.mode} options={[{ id: 'quick', name: 'Batalha rápida' }, { id: 'multiplayer', name: 'Multiplayer' }]} onChange={(mode) => changeRequirement(index, { ...r, mode: mode as 'quick' | 'multiplayer' })} />
              <NumberField label="Vitórias necessárias" min={1} value={r.target} onChange={(target) => changeRequirement(index, { ...r, target })} /></div>
            <div className="form-grid"><MultiSelect label="Adversários específicos" value={r.opponentUnitIds ?? []} options={catalog.characters} hint="Nenhum = qualquer adversário. Vários = pelo menos um deles." onChange={(ids) => {
              const { opponentUnitIds: _ids, ...rest } = r; changeRequirement(index, { ...rest, ...(ids.length ? { opponentUnitIds: ids } : {}) });
            }} /><MultiSelect label="Personagens usados pelo jogador" value={r.requiredPlayerUnitIds ?? []} options={catalog.characters} hint="Nenhum = qualquer equipe. Vários = pelo menos um deles." onChange={(ids) => {
              const { requiredPlayerUnitIds: _ids, ...rest } = r; changeRequirement(index, { ...rest, ...(ids.length ? { requiredPlayerUnitIds: ids } : {}) });
            }} /></div>
          </>}
        </fieldset>)}
        <button type="button" className="secondary" onClick={() => updateRule({ requirements: [...requirements, { kind: 'battle-wins', mode: 'quick', target: 5, description: 'Vença 5 batalhas rápidas.' }] })}>+ Adicionar requisito</button>
      </>}
    </section>
  </>;
}
