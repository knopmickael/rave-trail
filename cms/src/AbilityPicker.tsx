import { useState } from 'react';
import type { AbilityDefinition } from '../../shared/src/content/abilities';
import { effectSpecs, targets } from '../contracts';
import { Field, Select } from './fields';

export function AbilityPicker({ index, value, abilities, onChange }: {
  index: number; value: string; abilities: AbilityDefinition[]; onChange: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const selected = abilities.find((a) => a.id === value);
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const results = abilities.filter((a) => normalize(`${a.name} ${a.id}`).includes(normalize(search)));
  const options = selected && !results.includes(selected) ? [selected, ...results] : results;
  return <div className="ability-choice">
    <Field label={`Pesquisar habilidade ${index + 1} por nome`}><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome da habilidade…" /></Field>
    <Select label={`Habilidade ${index + 1}`} value={value} empty="Escolha uma habilidade" options={options} onChange={onChange} />
    {!results.length && <p className="muted" role="status">Nenhuma habilidade encontrada.</p>}
    {selected && <div className="ability-summary"><img src={selected.icon} alt={`Ícone de ${selected.name}`} width="52" height="52" />
      <div><strong>{selected.name}</strong><p>{selected.description}</p><p>{selected.energyCost} energia · {targets[selected.target]}</p>
        <ul>{selected.effects.map((effect, i) => <li key={i}>{effectSpecs[effect.kind].label}: {Object.entries(effectSpecs[effect.kind].fields).map(([field, spec]) => `${spec.label}: ${(effect as unknown as Record<string, number>)[field]}`).join(' · ')}</li>)}</ul>
      </div></div>}
  </div>;
}
