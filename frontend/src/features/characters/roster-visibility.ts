import { FINAL_ENCOUNTER_ID } from '@game/content/campaign-rules';
import { SECOND_CAMPAIGN_UNIT_IDS } from '@game/content/second-campaign';

const secondCampaignIds = new Set<string>(SECOND_CAMPAIGN_UNIT_IDS);

/** A revelação do elenco é independente da aquisição ou dos requisitos das missões. */
export function visibleRosterUnits<T extends { id: string }>(units: readonly T[], completedEncounters: readonly string[] = []): T[] {
  const completedFirstCampaign = completedEncounters.includes(FINAL_ENCOUNTER_ID);
  return units.filter((unit) => completedFirstCampaign || !secondCampaignIds.has(unit.id));
}
