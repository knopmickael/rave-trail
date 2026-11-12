import { z } from 'zod';

export const id = z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/);
const text = z.string().trim().min(1).max(200);
const description = z.string().trim().min(1).max(12000);
const integer = (min: number, max: number) => z.number().int().min(min).max(max);
export const image = z.string().max(2048).refine((value) => /^\/media\/[\w\-./%]+$/.test(value) && !value.includes('..')
  || (() => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } })(), 'Use /media/... ou uma URL HTTPS.');
const amount = integer(1, 10000);
const teamTurns = integer(1, 20);
export const effectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('damage'), amount }).strict(), z.object({ kind: z.literal('heal'), amount }).strict(),
  z.object({ kind: z.literal('drain'), amount }).strict(), z.object({ kind: z.literal('revive'), hpRatio: z.number().min(0.01).max(1) }).strict(),
  z.object({ kind: z.literal('guard'), reduction: amount, teamTurns }).strict(),
  z.object({ kind: z.literal('restore-energy'), amount: integer(1, 100) }).strict(),
  z.object({ kind: z.literal('extra-turn'), count: integer(1, 3) }).strict(),
  z.object({ kind: z.literal('bleed'), amount, turns: teamTurns }).strict(),
  z.object({ kind: z.literal('invulnerable'), teamTurns }).strict(), z.object({ kind: z.literal('attack-block'), teamTurns }).strict(),
  z.object({ kind: z.literal('damage-boost'), amount, teamTurns }).strict(),
]);
const abilityShape = {
  id, name: text, description, energyCost: integer(0, 100),
  target: z.enum(['enemy', 'ally', 'self', 'defeated-ally', 'all-enemies', 'all-allies', 'team']),
  effects: z.array(effectSchema).min(1).max(12), icon: image,
};
export const configSchema = z.object({ energyCost: abilityShape.energyCost, target: abilityShape.target, effects: abilityShape.effects }).strict().superRefine((ability, ctx) => {
  for (const effect of ability.effects) {
    const allowed = effect.kind === 'restore-energy' || effect.kind === 'extra-turn' ? ['team']
      : effect.kind === 'revive' ? ['defeated-ally']
      : ['damage', 'drain', 'bleed', 'attack-block'].includes(effect.kind) ? ['enemy', 'all-enemies']
      : ['ally', 'self', 'all-allies'];
    if (!allowed.includes(ability.target)) ctx.addIssue({ code: 'custom', path: ['effects'], message: `${effect.kind}: alvo incompatível (${allowed.join(', ')}).` });
  }
});
export const abilitySchema = z.object(abilityShape).strict().superRefine((value, ctx) => {
  const result = configSchema.safeParse({ energyCost: value.energyCost, target: value.target, effects: value.effects });
  if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
});
const ids = z.array(id).max(100).refine((values) => new Set(values).size === values.length, 'Não repita personagens ou habilidades.');
const requirement = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('encounter'), encounterId: id, target: z.literal(1), description }).strict(),
  z.object({ kind: z.literal('battle-wins'), mode: z.enum(['quick', 'multiplayer']), target: integer(1, 100000), description,
    opponentUnitIds: ids.min(1).optional(), requiredPlayerUnitIds: ids.min(1).optional() }).strict(),
]);
export const characterSchema = z.object({
  id, characterId: id, name: text, version: text, description, maxHp: integer(1, 10000), portrait: image, illustration: image,
  abilityIds: ids.length(4), rosterOrder: integer(0, 100000).nullable(),
  unlock: z.object({ kind: z.enum(['starter', 'premium', 'battle-wins']), description }).strict(),
  unlockRule: z.object({ unitId: id, description, requirements: z.array(requirement).min(1).max(30), availableAfterEncounterId: id.optional(), availableFromStart: z.boolean().optional() }).strict().nullable(),
  priceUsd: z.number().positive().max(10000).nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.unlock.kind === 'battle-wins' && (!value.unlockRule || value.unlockRule.unitId !== value.id)) ctx.addIssue({ code: 'custom', path: ['unlockRule'], message: 'Configure os requisitos de desbloqueio deste personagem.' });
  if (value.unlock.kind === 'battle-wins' && value.unlockRule && (value.unlockRule.availableFromStart === true) === !!value.unlockRule.availableAfterEncounterId) ctx.addIssue({ code: 'custom', path: ['unlockRule'], message: 'Escolha exatamente uma revelação: desde o início ou após uma batalha específica.' });
  if (value.unlock.kind !== 'battle-wins' && value.unlockRule !== null) ctx.addIssue({ code: 'custom', path: ['unlockRule'], message: 'Somente missões possuem requisitos de desbloqueio.' });
  if (value.unlock.kind === 'premium' && !value.priceUsd) ctx.addIssue({ code: 'custom', path: ['priceUsd'], message: 'Informe o preço.' });
});
export const campaignSchema = z.object({ id, chapterNumber: integer(1, 100000), title: text, description, background: image,
  mapBackground: image.nullable(), prerequisiteEncounterId: id.nullable(), sortOrder: integer(0, 100000), released: z.boolean() }).strict();
export const encounterSchema = z.object({ id, campaignId: id, position: integer(1, 100000), title: text, story: description,
  mapX: z.number().min(0).max(100), mapY: z.number().min(0).max(100),
  enemyUnitIds: z.array(id).min(1).max(3) }).strict();
export const characterOrderSchema = z.object({ ids: z.array(id).min(1).max(10000).refine((values) => new Set(values).size === values.length, 'Não repita personagens.') }).strict();
export const setupSchema = z.object({ id, name: text, config: configSchema }).strict();
export const proposalSchema = z.object({ message: description, ability: abilitySchema.nullable(),
  engineExtension: z.object({ summary: text, reason: description, suggestedConfig: description }).strict().nullable() }).strict();
