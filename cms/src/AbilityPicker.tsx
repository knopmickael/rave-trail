import { useId, useState } from 'react';
import type { AbilityDefinition } from '../../shared/src/content/abilities';
import { effectSpecs, targets } from '../contracts';
import { Field } from './fields';

export function AbilityPicker({ index, value, abilities, onChange }: {
  index: number; value: string; abilities: AbilityDefinition[]; onChange: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const groupName = useId();
  const selected = abilities.find((a) => a.id === value);
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const results = abilities.filter((a) => normalize(`${a.name} ${a.id}`).includes(normalize(search)));
  return <div className="ability-choice">
    <Field label={`Pesquisar habilidade ${index + 1} por nome`}><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou slug da habilidade…" /></Field>
    <fieldset className="ability-options"><legend>Habilidade {index + 1}</legend>
      <div className="ability-options-list">{results.map((ability) => <label className="ability-option" key={ability.id}>
        <input type="radio" name={groupName} value={ability.id} checked={ability.id === value} onChange={() => onChange(ability.id)} />
        <img src={ability.icon} alt="" width={36} height={36} loading="lazy" />
        <span><strong>{ability.name}</strong><small>{ability.id}</small></span>
        <span className="ability-option-cost">{ability.energyCost} energia</span>
      </label>)}</div>
    </fieldset>
    {!results.length && <p className="muted" role="status">Nenhuma habilidade encontrada.</p>}
    {selected && <div className="ability-summary"><img src={selected.icon} alt={`Ícone de ${selected.name}`} width="52" height="52" />
      <div><strong>{selected.name}</strong><p>{selected.description}</p><p>{selected.energyCost} energia · {targets[selected.target]}</p>
        <ul>{selected.effects.map((effect, i) => <li key={i}>{effectSpecs[effect.kind].label}: {Object.entries(effectSpecs[effect.kind].fields).map(([field, spec]) => `${spec.label}: ${(effect as unknown as Record<string, number>)[field] ?? 0}`).join(' · ')}</li>)}</ul>
      </div></div>}
  </div>;
}
