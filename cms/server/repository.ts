import type { Pool, PoolClient } from 'pg';
import type { AbilityDefinition } from '../../shared/src/content/abilities.js';
import { battleUnlockRules, premiumUnitPrices } from '../../shared/src/content/unlocks.js';
import { STARTER_UNIT_IDS } from '../../shared/src/content/units.js';
import { OSIRIS_UNIT_ID } from '../../shared/src/content/campaign-rules.js';
import type { Catalog, Character, Campaign, Encounter, Entity, Setup } from '../contracts.js';

export class CmsError extends Error { constructor(public statusCode: number, message: string) { super(message); } }
const tables = { characters: 'units', abilities: 'abilities', campaigns: 'campaigns', encounters: 'encounters' } as const;

export class CmsRepository {
  constructor(readonly pool: Pool) {}

  async catalog(): Promise<Catalog> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const characters = await client.query<Character>(`SELECT u.id, character_id AS "characterId", name, version, description,
        max_hp AS "maxHp", portrait_path AS portrait, illustration_path AS illustration, unlock_condition AS unlock,
        unlock_rule AS "unlockRule", (unlock_condition->>'priceUsd')::float AS "priceUsd", roster_order AS "rosterOrder",
        ARRAY(SELECT ability_id FROM unit_abilities WHERE unit_id = u.id ORDER BY slot_index) AS "abilityIds" FROM units u ORDER BY roster_order NULLS LAST, u.id`);
      for (const unit of characters.rows) {
        unit.unlockRule = unit.unlock.kind === 'battle-wins' ? unit.unlockRule ?? battleUnlockRules.find((rule) => rule.unitId === unit.id) ?? null : null;
        unit.priceUsd ??= premiumUnitPrices[unit.id] ?? null;
        // O preço é um detalhe de autoria, enviado separadamente do unlock.
        const { kind, description } = unit.unlock;
        unit.unlock = { kind, description };
      }
      const abilities = await client.query<AbilityDefinition>('SELECT id, name, description, energy_cost AS "energyCost", target, effects, icon_path AS icon FROM abilities ORDER BY name');
      const campaigns = await client.query<Campaign>('SELECT id, chapter_number AS "chapterNumber", title, description, background_path AS background, map_background_path AS "mapBackground", prerequisite_encounter_id AS "prerequisiteEncounterId", sort_order AS "sortOrder", released FROM campaigns ORDER BY sort_order');
      const encounters = await client.query<Encounter>(`SELECT e.id, campaign_id AS "campaignId", position, title, story, map_x::float AS "mapX", map_y::float AS "mapY",
        ARRAY(SELECT unit_id FROM encounter_enemies WHERE encounter_id = e.id ORDER BY slot_index) AS "enemyUnitIds" FROM encounters e ORDER BY campaign_id, position`);
      const setups = await client.query<Setup>('SELECT id, name, config FROM cms_ability_setups ORDER BY name');
      await client.query('COMMIT');
      return { characters: characters.rows, abilities: abilities.rows, campaigns: campaigns.rows, encounters: encounters.rows, setups: setups.rows };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(72583619)');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  private async mark(client: PoolClient, entity: string, id: string, deleted = false) {
    await client.query(`INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ($1,$2,$3)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp()`, [entity, id, deleted]);
  }

  async save(entity: Entity, value: Character | AbilityDefinition | Campaign | Encounter, create: boolean) {
    return this.transaction(async (client) => {
      const exists = await client.query(`SELECT 1 FROM ${tables[entity]} WHERE id = $1 FOR UPDATE`, [value.id]);
      if (create && exists.rowCount) throw new CmsError(409, 'Este ID já existe. Escolha outro ID.');
      if (!create && !exists.rowCount) throw new CmsError(404, 'Registro não encontrado. Recarregue o catálogo.');
      if (entity === 'characters') await this.saveCharacter(client, value as Character);
      if (entity === 'abilities') {
        const a = value as AbilityDefinition;
        await client.query(`INSERT INTO abilities (id,name,description,energy_cost,target,effects,icon_path) VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT (id) DO UPDATE SET name=$2,description=$3,energy_cost=$4,target=$5,effects=$6,icon_path=$7`,
        [a.id, a.name, a.description, a.energyCost, a.target, JSON.stringify(a.effects), a.icon]);
      }
      if (entity === 'campaigns') {
        const c = value as Campaign;
        if (c.prerequisiteEncounterId) {
          const own = await client.query('SELECT 1 FROM encounters WHERE id=$1 AND campaign_id=$2', [c.prerequisiteEncounterId, c.id]);
          if (own.rowCount) throw new CmsError(400, 'A campanha não pode exigir uma batalha dela mesma.');
        }
        await client.query(`INSERT INTO campaigns (id,chapter_number,title,description,background_path,map_background_path,prerequisite_encounter_id,sort_order,released)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET chapter_number=$2,title=$3,description=$4,background_path=$5,map_background_path=$6,prerequisite_encounter_id=$7,sort_order=$8,released=$9`,
        [c.id, c.chapterNumber, c.title, c.description, c.background, c.mapBackground, c.prerequisiteEncounterId, c.sortOrder, c.released]);
      }
      if (entity === 'encounters') {
        const e = value as Encounter;
        // Inserir/mover desloca as demais batalhas atomicamente; IDs/progresso permanecem estáveis.
        const previous = await client.query<{ campaign_id: string; position: number }>('SELECT campaign_id, position FROM encounters WHERE id=$1', [e.id]);
        if (previous.rows[0] && previous.rows[0].campaign_id !== e.campaignId) throw new CmsError(400, 'A campanha de um confronto existente não pode ser alterada.');
        const rows = await client.query<{ id: string }>('SELECT id FROM encounters WHERE campaign_id=$1 AND id<>$2 ORDER BY position FOR UPDATE', [e.campaignId, e.id]);
        const ordered = rows.rows.map((row) => row.id);
        if (e.position > ordered.length + 1) throw new CmsError(400, `A próxima posição disponível é ${ordered.length + 1}.`);
        ordered.splice(e.position - 1, 0, e.id);
        await client.query('UPDATE encounters SET position=position+1000000 WHERE campaign_id=$1', [e.campaignId]);
        await client.query(`INSERT INTO encounters (id,campaign_id,position,title,story,map_x,map_y) VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT (id) DO UPDATE SET position=$3,title=$4,story=$5,map_x=$6,map_y=$7`,
        [e.id, e.campaignId, 2000001, e.title, e.story, e.mapX, e.mapY]);
        for (const [index, encounterId] of ordered.entries()) {
          await client.query('UPDATE encounters SET position=$2 WHERE id=$1', [encounterId, index + 1]);
          await this.mark(client, 'encounters', encounterId);
        }
        await client.query('DELETE FROM encounter_enemies WHERE encounter_id=$1', [e.id]);
        for (const [slot, unitId] of e.enemyUnitIds.entries()) await client.query('INSERT INTO encounter_enemies VALUES ($1,$2,$3)', [e.id, slot, unitId]);
      }
      await this.mark(client, entity, value.id);
      return { id: value.id };
    });
  }

  private async saveCharacter(client: PoolClient, c: Character) {
    const encounterIds = [c.unlockRule?.availableAfterEncounterId,
      ...c.unlockRule?.requirements.flatMap((r) => r.kind === 'encounter' ? [r.encounterId] : []) ?? []].filter((v): v is string => !!v);
    if (encounterIds.length) {
      const found = await client.query('SELECT id FROM encounters WHERE id=ANY($1::text[])', [encounterIds]);
      if (found.rowCount !== new Set(encounterIds).size) throw new CmsError(400, 'Há uma batalha inexistente nos requisitos.');
    }
    const unitIds = c.unlockRule?.requirements.flatMap((r) => r.kind === 'battle-wins' ? [...r.opponentUnitIds ?? [], ...r.requiredPlayerUnitIds ?? []] : []) ?? [];
    if (unitIds.length) {
      const found = await client.query('SELECT id FROM units WHERE id=ANY($1::text[])', [unitIds.filter((id) => id !== c.id)]);
      if (found.rowCount !== new Set(unitIds.filter((id) => id !== c.id)).size) throw new CmsError(400, 'Há um personagem inexistente nos requisitos.');
    }
    await client.query('INSERT INTO narrative_characters (id,name) VALUES ($1,$2) ON CONFLICT DO NOTHING', [c.characterId, c.name]);
    await this.mark(client, 'narrative', c.characterId);
    const description = c.unlock.kind === 'starter' ? 'Disponível desde o início da jornada.' : c.unlock.kind === 'premium'
      ? `Personagem premium: US$ ${c.priceUsd?.toFixed(2).replace('.', ',')}.` : c.unlockRule!.requirements.map((r) => r.description).join(' ');
    const unlock = { kind: c.unlock.kind, description, ...(c.unlock.kind === 'premium' ? { priceUsd: c.priceUsd } : {}) };
    await client.query(`INSERT INTO units (id,character_id,name,version,description,max_hp,portrait_path,illustration_path,unlock_condition,unlock_rule,roster_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,(SELECT COALESCE(MAX(roster_order),-1)+1 FROM units)) ON CONFLICT (id) DO UPDATE SET character_id=$2,name=$3,version=$4,description=$5,max_hp=$6,portrait_path=$7,illustration_path=$8,unlock_condition=$9,unlock_rule=$10`,
    [c.id, c.characterId, c.name, c.version, c.description, c.maxHp, c.portrait, c.illustration, JSON.stringify(unlock),
      c.unlock.kind === 'battle-wins' ? JSON.stringify({ ...c.unlockRule, description }) : null]);
    await client.query('DELETE FROM unit_abilities WHERE unit_id=$1', [c.id]);
    for (const [slot, abilityId] of c.abilityIds.entries()) await client.query('INSERT INTO unit_abilities VALUES ($1,$2,$3)', [c.id, slot, abilityId]);
  }

  async remove(entity: Entity, id: string) {
    return this.transaction(async (client) => {
      let encounterCampaign: string | undefined;
      if (entity === 'characters') {
        if ([...STARTER_UNIT_IDS, 'protagonist-main-transformed', OSIRIS_UNIT_ID].includes(id)) throw new CmsError(409, 'Personagem necessário às regras especiais do motor. Você pode editar seus dados, mas não excluir este ID.');
        // IDs históricos em JSON também constituem referências; nunca reescrever partidas/progresso para apagar conteúdo.
        const used = await client.query(`SELECT 1 FROM player_progress WHERE (data->'unlockedUnitIds') ? $1
          UNION ALL SELECT 1 FROM battles WHERE state @> jsonb_build_object('teams', jsonb_build_object('player', jsonb_build_object('units',jsonb_build_array(jsonb_build_object('unitId',$1::text)))) )
          OR state @> jsonb_build_object('teams', jsonb_build_object('enemy', jsonb_build_object('units',jsonb_build_array(jsonb_build_object('unitId',$1::text))))) LIMIT 1`, [id]);
        if (used.rowCount) throw new CmsError(409, 'Personagem usado no progresso ou histórico de jogadores. Remova apenas conteúdo sem uso.');
        const ruleUse = await client.query('SELECT 1 FROM units WHERE id<>$1 AND unlock_rule::text LIKE $2 LIMIT 1', [id, `%"${id}"%`]);
        if (ruleUse.rowCount) throw new CmsError(409, 'Personagem usado em requisitos de desbloqueio.');
        await client.query('DELETE FROM unit_abilities WHERE unit_id=$1', [id]);
      }
      if (entity === 'abilities') {
        const used = await client.query(`SELECT 1 FROM battles WHERE state->'abilities' ? $1 LIMIT 1`, [id]);
        if (used.rowCount) throw new CmsError(409, 'Habilidade usada no histórico de batalhas.');
      }
      if (entity === 'encounters') {
        const legacyReference = battleUnlockRules.some((rule) => rule.availableAfterEncounterId === id || rule.requirements.some((r) => r.kind === 'encounter' && r.encounterId === id));
        if (legacyReference) throw new CmsError(409, 'Confronto usado pelas regras originais de desbloqueio.');
        encounterCampaign = (await client.query<{ campaign_id: string }>('SELECT campaign_id FROM encounters WHERE id=$1', [id])).rows[0]?.campaign_id;
        const used = await client.query(`SELECT 1 FROM units WHERE unlock_condition->>'encounterId'=$1 OR unlock_rule::text LIKE $2
          UNION ALL SELECT 1 FROM player_progress WHERE (data->'completedEncounters') ? $1 LIMIT 1`, [id, `%"${id}"%`]);
        if (used.rowCount) throw new CmsError(409, 'Confronto usado no progresso ou em requisitos de desbloqueio.');
        await client.query('DELETE FROM encounter_enemies WHERE encounter_id=$1', [id]);
      }
      const result = await client.query(`DELETE FROM ${tables[entity]} WHERE id=$1 RETURNING id`, [id]);
      if (!result.rowCount) throw new CmsError(404, 'Registro não encontrado.');
      await this.mark(client, entity, id, true);
      if (entity === 'encounters') {
        const remaining = await client.query<{ id: string; campaign_id: string }>('SELECT id, campaign_id FROM encounters WHERE campaign_id=$1 ORDER BY position', [encounterCampaign]);
        await client.query('UPDATE encounters SET position=position+1000000 WHERE campaign_id=$1', [encounterCampaign]);
        const counts = new Map<string, number>();
        for (const row of remaining.rows) {
          const position = (counts.get(row.campaign_id) ?? 0) + 1;
          counts.set(row.campaign_id, position);
          await client.query('UPDATE encounters SET position=$2 WHERE id=$1', [row.id, position]);
          await this.mark(client, 'encounters', row.id);
        }
      }
      return { id };
    });
  }

  async reorderCharacters(ids: string[]) {
    return this.transaction(async (client) => {
      const rows = await client.query<{ id: string }>('SELECT id FROM units FOR UPDATE');
      const current = new Set(rows.rows.map((row) => row.id));
      if (ids.length !== current.size || new Set(ids).size !== current.size || ids.some((id) => !current.has(id))) {
        throw new CmsError(409, 'O catálogo mudou. Recarregue a lista antes de reordenar.');
      }
      await client.query('UPDATE units SET roster_order=NULL');
      for (const [order, id] of ids.entries()) {
        await client.query('UPDATE units SET roster_order=$2 WHERE id=$1', [id, order]);
        await this.mark(client, 'characters', id);
      }
      return { ids };
    });
  }

  async saveSetup(setup: Setup) {
    await this.pool.query(`INSERT INTO cms_ability_setups (id,name,config) VALUES ($1,$2,$3)
      ON CONFLICT (id) DO UPDATE SET name=$2,config=$3,updated_at=now()`, [setup.id, setup.name, JSON.stringify(setup.config)]);
    return { id: setup.id };
  }
}
