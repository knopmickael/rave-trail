import type { CharacterId, UnitDefinition } from '@game/content/units';

type Palette = { skin: string; hair: string; coat: string; accent: string; longHair?: boolean };
const palettes: Partial<Record<CharacterId, Palette>> = {
  'protagonist-main': { skin: '#e8b48d', hair: '#693c2b', coat: '#a45532', accent: '#e7c578' },
  'protagonist-secondary': { skin: '#d8ac8a', hair: '#263b42', coat: '#3d6371', accent: '#b5d2ce' },
  'protagonist-female': { skin: '#bc8769', hair: '#352b36', coat: '#477769', accent: '#e8c978', longHair: true },
  'road-raider-1': { skin: '#d0a080', hair: '#51453b', coat: '#735143', accent: '#cab194' },
  'road-raider-2': { skin: '#b87f5d', hair: '#292e33', coat: '#75644d', accent: '#d7bf8b' },
  'road-raider-3': { skin: '#e0ad8d', hair: '#7c4e37', coat: '#6d4e50', accent: '#cfb68e', longHair: true },
  'rival-a': { skin: '#c99676', hair: '#804633', coat: '#854c41', accent: '#dab374' },
  'rival-b': { skin: '#e0b495', hair: '#263c47', coat: '#48586d', accent: '#a8c7d0' },
  'rival-female': { skin: '#d6a07b', hair: '#784b38', coat: '#687358', accent: '#d8c78b', longHair: true },
  'passage-guardian': { skin: '#b88361', hair: '#45413e', coat: '#5c4d6b', accent: '#dbc07e' },
  'guardian-healer-male': { skin: '#d9ab89', hair: '#736045', coat: '#7b806b', accent: '#e6d6ae' },
  'guardian-healer-female': { skin: '#ac795e', hair: '#3c3330', coat: '#73816b', accent: '#e6d6ae', longHair: true },
  'legendary-beast': { skin: '#b4b8ae', hair: '#394f57', coat: '#394f57', accent: '#d6b867' },
  'guerreiros-habilidosos-a': { skin: '#bd8968', hair: '#573728', coat: '#8c5137', accent: '#e4ba71' },
  'guerreiros-habilidosos-b': { skin: '#dfad89', hair: '#273d47', coat: '#405b73', accent: '#c0ced5' },
  'guerreiros-habilidosos-c': { skin: '#a97659', hair: '#30332b', coat: '#52694d', accent: '#dcc98a' },
};

/** Arte vetorial temporária original, substituível pelas ilustrações definitivas. */
export function MockCharacterDrawing({ unit, face = false }: { unit: UnitDefinition; face?: boolean }) {
  const base = palettes[unit.characterId] ?? { skin: '#d8ac8a', hair: '#263b42', coat: '#52694d', accent: '#dcc98a' };
  const palette = unit.id === 'rival-b-final-mode'
    ? { ...base, coat: '#49232c', accent: '#dc9b54' }
    : base;
  const beast = unit.characterId === 'legendary-beast';
  return (
    <svg className="character-art" viewBox={face ? '42 8 116 116' : '0 0 200 340'} aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="322" rx="57" ry="10" fill="#233b38" opacity=".15" />
      {beast ? <>
        <path d="M43 304 49 164 75 106 125 106 153 164 160 304 137 317 118 247 82 247 62 317Z" fill={palette.coat} />
        <path d="M56 68 49 15 82 36 100 27 119 36 153 15 143 69 129 106 100 121 72 106Z" fill={palette.skin} />
        <path d="M62 69 83 72 78 81 65 78M139 69 117 72 123 81 135 78" fill={palette.accent} />
        <path d="m90 96 10-5 11 5-11 10Z" fill={palette.hair} />
        <path d="m79 131 21 34 22-34-9 70H89Z" fill={palette.accent} />
      </> : <>
        <path d="M70 225 66 307 88 310 101 246 111 310 134 307 130 225Z" fill="#344447" />
        <path d="M65 301 91 303 91 323 56 323 56 313ZM110 303 136 301 145 313 145 323 110 323Z" fill="#493d35" />
        {palette.longHair && <path d="M58 55Q100 6 142 55L149 155 123 181 65 158Z" fill={palette.hair} />}
        <path d="m73 116-22 23-23 86 16 6 34-63ZM126 116l23 23 23 86-16 6-34-63Z" fill={palette.coat} />
        <path d="m28 224 15 4-3 21-13-2ZM156 228l16-4 1 23-13 2Z" fill={palette.skin} />
        <path d="M75 112 100 124 125 112 141 226Q100 245 59 226Z" fill={palette.coat} />
        <path d="m75 112 25 12 25-12-10 28H85Z" fill={palette.accent} />
        <path d="M88 94h24v29q-12 14-24 0Z" fill={palette.skin} />
        <ellipse cx="100" cy="66" rx="36" ry="43" fill={palette.skin} />
        <path d="M63 69 60 43 73 20 91 15 106 8 118 22 137 25 144 48 138 72 128 42 109 47 101 35 86 49 74 43Z" fill={palette.hair} />
        <path d="M77 66h12M111 66h12" stroke={palette.hair} strokeWidth="3" strokeLinecap="round" />
        <path d="M83 73v5M117 73v5" stroke="#233236" strokeWidth="4" strokeLinecap="round" />
        <path d="m99 79-3 9 6 1" fill="none" stroke="#956851" strokeWidth="2" strokeLinecap="round" />
        <path d="M91 97q9 5 18 0" fill="none" stroke="#81533f" strokeWidth="2" strokeLinecap="round" />
        <path d="M65 203h70l2 13H63Z" fill="#4a3d32" />
        <path d="M94 202h13v15H94Z" fill={palette.accent} />
        <path d="m115 143 8 8-8 8-8-8Z" fill={palette.accent} />
      </>}
    </svg>
  );
}

export function CharacterArt({ unit, face = false }: { unit: UnitDefinition; face?: boolean }) {
  return <img className="character-art" src={face ? unit.portrait : unit.illustration} alt="" draggable={false} />;
}
