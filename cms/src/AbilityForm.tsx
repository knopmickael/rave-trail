import type { AbilityDefinition, AbilityEffect } from '../../shared/src/content/abilities';
import { effectSpecs, targets, type Catalog } from '../contracts';
import { ImageField, NumberField, Select, Text } from './fields';

export function AbilityForm({ value: a, onChange, catalog }: {
  value: AbilityDefinition; onChange: (value: AbilityDefinition) => void; catalog: Catalog;
}) {
  const update = (patch: Partial<AbilityDefinition>) => onChange({ ...a, ...patch });
  return <>
    <section className="form-section"><div className="section-heading"><span>01</span><h3>Identidade da habilidade</h3></div>
      <Text label="Nome da habilidade" value={a.name} onChange={(name) => update({ name })} /><Text label="Descrição textual" multiline value={a.description} onChange={(description) => update({ description })} />
      <ImageField label="Imagem da habilidade" value={a.icon} onChange={(icon) => update({ icon })} />
    </section>
    <section className="form-section"><div className="section-heading"><span>02</span><h3>Comportamento em batalha</h3></div>
      <div className="form-grid"><NumberField label="Custo de energia" value={a.energyCost} min={0} max={100} onChange={(energyCost) => update({ energyCost })} />
        <Select label="Alvo da habilidade" value={a.target} options={Object.entries(targets).map(([id, name]) => ({ id, name }))} onChange={(target) => update({ target: target as AbilityDefinition['target'] })} /></div>
      <p className="callout">Os efeitos são executados em sequência e compartilham o alvo da habilidade. Ataques usam inimigos; cura e defesa usam aliados; energia e turnos usam a equipe.</p>
      {a.effects.map((effect, index) => <fieldset className="effect-card" key={index}><legend>Efeito {index + 1}</legend>
        <div className="row"><Select label={`Tipo do efeito ${index + 1}`} value={effect.kind} options={Object.entries(effectSpecs).map(([id, spec]) => ({ id, name: spec.label }))} onChange={(kind) => {
          const spec = effectSpecs[kind as AbilityEffect['kind']];
          const value = { kind, ...Object.fromEntries(Object.entries(spec.fields).map(([field, config]) => [field, config.initial])) } as AbilityEffect;
          update({ effects: a.effects.map((e, i) => i === index ? value : e) });
        }} /><button type="button" className="text-button danger" disabled={a.effects.length === 1} onClick={() => { if (window.confirm(`Remover o efeito ${index + 1}?`)) update({ effects: a.effects.filter((_, i) => i !== index) }); }}>Remover efeito</button></div>
        <div className="form-grid">{Object.entries(effectSpecs[effect.kind].fields).map(([field, config]) => <NumberField key={field} label={config.label} min={config.min} max={config.max} step={config.step ?? 1}
          value={(effect as unknown as Record<string, number>)[field] ?? 0} onChange={(number) => update({ effects: a.effects.map((e, i) => i === index ? { ...e, [field]: number } : e) })} />)}</div>
      </fieldset>)}
      <button type="button" className="secondary" disabled={a.effects.length >= 12} onClick={() => update({ effects: [...a.effects, { kind: 'damage', amount: 20 }] })}>+ Combinar outro efeito</button>
    </section>
    <section className="form-section"><div className="section-heading"><span>03</span><h3>Onde esta habilidade aparece</h3></div><p className="muted">{catalog.characters.filter((c) => c.abilityIds.includes(a.id)).map((c) => c.name).join(' · ') || 'Nenhum personagem vinculado ainda.'}</p></section>
  </>;
}
