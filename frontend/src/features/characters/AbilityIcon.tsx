import type { AbilityDefinition } from '@game/content/abilities';

export function AbilityIcon({ ability }: { ability: AbilityDefinition }) {
  return <span className="ability-icon" aria-hidden="true"><img src={ability.icon} alt="" draggable={false} /></span>;
}

export function MockAbilityDrawing({ ability }: { ability: AbilityDefinition }) {
  const kind = ability.effects[0].kind;
  return (
    <span className={`ability-icon ability-icon--${kind}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'damage' && <><path d="m13 35 21-21 1-6-6 1L8 30ZM11 26l11 11M11 36l-4 5" /><path d="m31 29 8 2M32 36l3 5M23 7l-2 6" /></>}
        {kind === 'guard' && <><path d="m24 6 14 6v12c0 9-14 17-14 17S10 33 10 24V12Z" /><path d="m17 23 5 5 10-12" /></>}
        {kind === 'restore-energy' && <><path d="M27 5 12 26h11l-2 17 15-24H25Z" /><path d="M7 9v6M4 12h6M39 33v6M36 36h6" /></>}
        {kind === 'heal' && <><path d="M18 8h12v10h10v12H30v10H18V30H8V18h10Z" /></>}
        {kind === 'extra-turn' && <><circle cx="24" cy="25" r="15" /><path d="M24 16v10l7 4M18 5h12M24 5v5M36 11l4 4" /></>}
      </svg>
    </span>
  );
}
