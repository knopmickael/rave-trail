import { content } from './content';
import { errorMessages } from './errors';
import { messages, type Message } from './messages';

export type Locale = 'pt-BR' | 'en';
export type LanguagePreference = Locale | 'auto';
type Values = Readonly<Record<string, string | number>>;

const dictionary: Readonly<Record<string, string>> = { ...content, ...errorMessages, ...messages };
const lookup = (source: string) => Object.hasOwn(dictionary, source) ? dictionary[source] : undefined;

export function translate(locale: Locale, source: Message, values: Values = {}): string {
  const template = locale === 'en' ? messages[source] : source;
  // A single pass preserves user-provided values literally, including braces.
  return template.replace(/\{(\w+)\}/g, (token, key: string) => Object.hasOwn(values, key) ? String(values[key]) : token);
}

type Pattern = readonly [RegExp, (match: RegExpMatchArray, text: (source: string) => string) => string];
// Compatibility mapper for dynamic Portuguese messages from the existing API.
// These are full-message matches, never replacements in user names or DOM text.
const patterns: readonly Pattern[] = [
  [/^Finalize a batalha (\d+) da campanha (\d+)\.?$/, ([, battle, campaign]) => `Complete battle ${battle} of campaign ${campaign}`],
  [/^Vença (\d+) (?:partidas no modo|batalhas na) [Bb]atalha rápida\.$/, ([, count]) => `Win ${count} Quick battles.`],
  [/^Derrote (.+) na Batalha rápida (\d+) vezes(?: utilizando (.+))?\.$/, ([, name, count, allies], text) =>
    `Defeat ${text(name)} in Quick battle ${count} times${allies ? ` using ${text(allies)}` : ''}.`],
  [/^(.+) está impedido de atacar neste turno\.$/, ([, name], text) => `${text(name)} cannot attack this turn.`],
  [/^Energia insuficiente para (.+)\. Ajuste a ordem do combo\.$/, ([, name], text) => `Not enough energy for ${text(name)}. Adjust the combo order.`],
  [/^(.+) despertou como (.+)!$/, ([, before, after], text) => `${text(before)} awakened as ${text(after)}!`],
  [/^(.+) recupera (\d+) HP\.$/, ([, name, amount], text) => `${text(name)} recovers ${amount} HP.`],
  [/^A Guarda de (.+) expirou\.$/, ([, name], text) => `${text(name)}’s Guard has expired.`],
  [/^(.+) pode voltar a atacar\.$/, ([, name], text) => `${text(name)} can attack again.`],
  [/^A Força interna de (.+) expirou\.$/, ([, name], text) => `${text(name)}’s Inner Strength has expired.`],
  [/^A invulnerabilidade de (.+) expirou\.$/, ([, name], text) => `${text(name)}’s invulnerability has expired.`],
  [/^(.+) sofre (\d+) de dano de sangramento\.$/, ([, name, amount], text) => `${text(name)} takes ${amount} bleeding damage.`],
  [/^(.+) foi derrotado\.$/, ([, name], text) => `${text(name)} was defeated.`],
  [/^(.+) está invulnerável: o sangramento não causa dano\.$/, ([, name], text) => `${text(name)} is invulnerable: bleeding deals no damage.`],
  [/^(Sua equipe|Equipe inimiga) inicia o turno (\d+): \+15 de energia \(total (\d+)\)\.$/, ([, team, turn, energy], text) => `${text(team)} starts turn ${turn}: +15 energy (total ${energy}).`],
  [/^(.+): (.+) \(−(\d+) energia\)\.$/, ([, name, ability, cost], text) => `${text(name)}: ${text(ability)} (−${cost} energy).`],
  [/^(.+): MISS — (.+) (já está vivo|já foi derrotado)\. O custo foi mantido\.$/, ([, actor, target, status], text) => `${text(actor)}: MISS — ${text(target)} ${status === 'já está vivo' ? 'is already alive' : 'has already been defeated'}. Energy was still spent.`],
  [/^(.+) recupera (\d+) de energia para a equipe\.$/, ([, name, amount], text) => `${text(name)} restores ${amount} team energy.`],
  [/^(.+) concede (\d+) turno adicional à equipe\.$/, ([, name, count], text) => `${text(name)} grants the team ${count} extra turn(s).`],
  [/^(.+) retorna dos mortos com (\d+) HP\.$/, ([, name, hp], text) => `${text(name)} returns from the dead with ${hp} HP.`],
  [/^(.+) está invulnerável e não recebe dano\.$/, ([, name], text) => `${text(name)} is invulnerable and takes no damage.`],
  [/^(.+) recebe (\d+) de dano\.$/, ([, name, damage], text) => `${text(name)} takes ${damage} damage.`],
  [/^Guarda aplicada em (.+): −(\d+) por golpe, por (\d+) turnos\.$/, ([, name, reduction, turns], text) => `Guard applied to ${text(name)}: −${reduction} per hit for ${turns} turns.`],
  [/^(.+) está sangrando: (\d+) de dano por (\d+) turnos\.$/, ([, name, damage, turns], text) => `${text(name)} is bleeding: ${damage} damage for ${turns} turns.`],
  [/^(.+) ficará invulnerável no próximo turno inimigo\.$/, ([, name], text) => `${text(name)} will be invulnerable during the next enemy turn.`],
  [/^(.+) não poderá atacar durante (\d+) turno\(s\)\.$/, ([, name, turns], text) => `${text(name)} cannot attack for ${turns} turn(s).`],
  [/^(.+) recebe Força interna: \+(\d+) de dano nos próximos (\d+) turnos da equipe\.$/, ([, name, damage, turns], text) => `${text(name)} gains Inner Strength: +${damage} damage for the next ${turns} team turns.`],
  [/^Grande rei Osiris ocupa o slot (\d+) como aliado convidado\.$/, ([, slot]) => `Great King Osiris occupies slot ${slot} as a guest ally.`],
];

const historicalMessages: Readonly<Record<string, string>> = {
  'Derrota.': 'Defeat.',
  'Batalha iniciada. Sua equipe começa o turno 1 com 15 de energia.': 'Battle started. Your team starts turn 1 with 15 energy.',
  'Tempo de 45 segundos esgotado. Turno encerrado automaticamente.': 'The 45-second timer expired. The turn ended automatically.',
  'Batalha encerrada por desistência.': 'Battle ended by surrender.',
};

export function translateText(locale: Locale, source: string | null | undefined): string {
  if (!source || locale === 'pt-BR') return source ?? '';
  const exact = lookup(source) ?? (Object.hasOwn(historicalMessages, source) ? historicalMessages[source] : undefined);
  if (exact !== undefined) return exact;
  // Unlock tooltips join requirements, including campaign requirements without
  // a trailing period. Split before matching the variable opponent names.
  if (/^(?:Finalize a batalha |Vença \d+ |Derrote )/u.test(source)) {
    const requirements = source.split(/(?<=[.\d])\s+(?=Vença \d+ |Derrote |Finalize a batalha )/u);
    if (requirements.length > 1) return requirements.map((part, index) => {
      const translated = translateText(locale, part);
      return index < requirements.length - 1 && !translated.endsWith('.') ? `${translated}.` : translated;
    }).join(' ');
  }
  for (const [pattern, render] of patterns) {
    const match = source.match(pattern);
    if (match) return render(match, (part) => translateText(locale, part));
  }
  return source;
}
