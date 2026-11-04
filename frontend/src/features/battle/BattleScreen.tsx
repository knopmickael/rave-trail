import { useEffect, useRef, useState } from 'react';
import { previewActions, type BattleAction, type BattleEvent, type BattleRecord, type Fighter } from '@game/core/battle';
import type { AbilityDefinition } from '@game/content/abilities';
import { api, ApiError } from '../../api';
import { assets } from '../../assets';
import { isFinalEncounter } from '@game/content/campaign-rules';
import { playSoundEffect } from '../../audio/soundEffects';
import { AbilityTooltip } from './AbilityTooltip';
import './battle.css';

export function BattleScreen({ initialBattle, title, onBack, onSessionExpired }: {
  initialBattle: BattleRecord; title: string; onBack: () => void; onSessionExpired: () => void;
}) {
  const [battle, setBattle] = useState(initialBattle);
  const [queue, setQueue] = useState<BattleAction[]>([]);
  const [pending, setPending] = useState<{ actorId: string; abilityId: string } | null>(null);
  const [now, setNow] = useState(Date.now);
  const [events, setEvents] = useState<BattleEvent[]>(initialBattle.log ?? []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revealedEnemyActions, setRevealedEnemyActions] = useState(0);
  const [dependencyWarning, setDependencyWarning] = useState<{ removed: string; dependents: string[] } | null>(null);
  const inFlight = useRef(false);
  const pendingRequest = useRef<{ signature: string; id: string } | null>(null);
  const logDialog = useRef<HTMLDialogElement>(null);
  const surrenderDialog = useRef<HTMLDialogElement>(null);
  const dependencyDialog = useRef<HTMLDialogElement>(null);
  const latestBattle = useRef(battle);
  const acceptedEventCount = useRef(initialBattle.log?.length ?? 0);
  latestBattle.current = battle;
  const state = battle.state;
  const active = state.status === 'active';
  const remaining = battle.turnDeadlineAt ? Math.max(0, Math.ceil((Date.parse(battle.turnDeadlineAt) - now) / 1000)) : 45;
  const playerTurn = active && state.activeSide === 'player' && remaining > 0;
  const turnLabel = state.activeSide === 'enemy' ? 'Aguardando inimigo' : 'Encerrar turno';
  const quickBattle = battle.encounterId === null;
  const finalBattle = isFinalEncounter(battle.encounterId);
  const targetAbility = pending ? state.abilities[pending.abilityId] : null;
  const targetingEnemy = !!playerTurn && !!pending && targetAbility?.target === 'enemy';
  const tooltipReset = `${battle.revision}:${busy}:${pending?.abilityId ?? ''}:${queue.map((entry) => entry.actorId + entry.abilityId).join(',')}`;
  let preview: ReturnType<typeof previewActions> | null = null;
  let queueError = '';
  if (active) {
    try { preview = previewActions(state, queue); }
    catch (cause) { queueError = cause instanceof Error ? cause.message : 'Fila inválida.'; }
  }
  const energy = Math.max(0, (preview?.state.teams.player.energy ?? state.teams.player.energy) - (targetAbility?.energyCost ?? 0));
  const serverCombo = battle.combo?.side === state.activeSide ? battle.combo.actions : [];
  const enemyTurn = active && state.activeSide === 'enemy';
  const revealingEnemy = enemyTurn && !!battle.botActsAt;
  const visibleServerCombo = revealingEnemy ? serverCombo.slice(0, revealedEnemyActions) : serverCombo;
  const comboActions = playerTurn
    ? [...serverCombo, ...queue.filter((entry) => !serverCombo.some((action) => action.actorId === entry.actorId))]
    : visibleServerCombo;
  const logEntries = buildLogEntries(events, state);
  const logGroups = groupLogEntries(logEntries);
  const finalComboEntries = active ? [] : logEntries.filter((entry) => entry.actionId.startsWith(`${state.activeSide}:${state.turn}:`));

  function cancelAction(actorId: string) {
    setQueue((previous) => previous.filter((action) => action.actorId !== actorId));
    if (pending?.actorId === actorId) setPending(null);
    setError('');
  }

  function actionLabel(action: BattleAction) {
    const actor = state.teams.player.units.find((unit) => unit.id === action.actorId);
    const ability = state.abilities[action.abilityId];
    return `${actor?.name ?? 'Personagem'}: ${ability?.name ?? 'Habilidade'}`;
  }

  function requestRemoveAction(actorId: string) {
    const action = queue.find((entry) => entry.actorId === actorId);
    if (!action) return;
    const remaining = queue.filter((entry) => entry.actorId !== actorId);
    let dependent: BattleAction | null = null;
    for (let index = 0; index < remaining.length; index++) {
      try { previewActions(state, remaining.slice(0, index + 1)); }
      catch { dependent = remaining[index]; break; }
    }
    if (dependent) {
      setDependencyWarning({
        removed: state.abilities[action.abilityId]?.name ?? 'Ação',
        dependents: [actionLabel(dependent)],
      });
      dependencyDialog.current?.showModal();
      return;
    }
    cancelAction(actorId);
  }

  function addAction(action: BattleAction) {
    if (busy || !playerTurn) return;
    const updated = [...queue.filter((entry) => entry.actorId !== action.actorId), action];
    try {
      previewActions(state, updated);
      setQueue(updated);
      setPending(null);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível selecionar a habilidade.'); }
  }

  function chooseAbility(unit: Fighter, ability: AbilityDefinition) {
    if (busy || !playerTurn || unit.hp <= 0) return;
    if (pending?.actorId === unit.id && pending.abilityId === ability.id) { cancelAction(unit.id); return; }
    const chosen = queue.find((entry) => entry.actorId === unit.id);
    if (chosen || pending || ability.energyCost > energy) return;
    if (ability.target === 'enemy' || ability.target === 'ally' || ability.target === 'defeated-ally') {
      setPending({ actorId: unit.id, abilityId: ability.id });
      setError('');
    } else addAction({ actorId: unit.id, abilityId: ability.id });
  }

  function acceptBattle(record: BattleRecord, fallbackEvents = events) {
    if (record.revision < latestBattle.current.revision) return;
    const updatedEvents = record.log ?? fallbackEvents;
    if (record.revision > latestBattle.current.revision) {
      if (record.state.turn > latestBattle.current.state.turn) playSoundEffect('turn');
      for (const event of updatedEvents.slice(acceptedEventCount.current)) {
        if (event.kind === 'defeated') playSoundEffect('defeated');
      }
    }
    if (latestBattle.current.state.status === 'active' && (record.state.status === 'victory' || record.state.status === 'defeat')) {
      playSoundEffect(record.state.status);
    }
    acceptedEventCount.current = updatedEvents.length;
    latestBattle.current = record;
    setBattle(record);
    setEvents(updatedEvents);
    setQueue([]);
    setPending(null);
  }

  useEffect(() => {
    if (!active || !battle.turnDeadlineAt) return;
    const clock = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(clock);
  }, [active, battle.turnDeadlineAt]);

  useEffect(() => {
    if (!revealingEnemy || !serverCombo.length) return;
    setRevealedEnemyActions(0);
    const timers = serverCombo.map((_, index) =>
      window.setTimeout(() => setRevealedEnemyActions(index + 1), (index + 1) * 1_200));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [battle.id, battle.revision, revealingEnemy, serverCombo.length]);

  useEffect(() => {
    if (!active || !battle.turnDeadlineAt) return;
    let mounted = true;
    let polling = false;
    const refresh = async () => {
      if (polling || inFlight.current) return;
      polling = true;
      try {
        const record = await api.battle(battle.id);
        if (mounted) setError((previous) => previous === 'Não foi possível sincronizar a batalha. Tentando novamente…' ? '' : previous);
        if (mounted && record.revision > latestBattle.current.revision) {
          acceptBattle(record);
          pendingRequest.current = null;
          setError('');
        }
      } catch (cause) {
        if (mounted) {
          if (cause instanceof ApiError && cause.status === 401) onSessionExpired();
          else setError('Não foi possível sincronizar a batalha. Tentando novamente…');
        }
      } finally { polling = false; }
    };
    const resume = () => { setNow(Date.now()); void refresh(); };
    const visible = () => { if (!document.hidden) resume(); };
    const interval = setInterval(() => { void refresh(); }, 1000);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', visible);
    document.addEventListener('resume', resume);
    void refresh();
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', visible);
      document.removeEventListener('resume', resume);
    };
  }, [battle.id, active, battle.turnDeadlineAt, onSessionExpired]);

  async function handleFailure(cause: unknown, fallback: string) {
    if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
    if (cause instanceof ApiError && cause.status === 409) {
      try { acceptBattle(await api.battle(battle.id)); }
      catch (refreshError) {
        if (refreshError instanceof ApiError && refreshError.status === 401) { onSessionExpired(); return; }
      }
    }
    setError(cause instanceof Error ? cause.message : fallback);
  }

  async function confirmTurn() {
    if (inFlight.current || queueError || pending || !playerTurn) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    const signature = JSON.stringify({ revision: battle.revision, queue });
    if (pendingRequest.current?.signature !== signature) pendingRequest.current = { signature, id: crypto.randomUUID() };
    try {
      const response = await api.turn(battle.id, battle.revision, pendingRequest.current.id, queue);
      acceptBattle(response.battle, [...events, ...response.events]);
      pendingRequest.current = null;
    } catch (cause) { await handleFailure(cause, 'Não foi possível encerrar o turno.'); }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function surrender() {
    if (inFlight.current || !active) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      acceptBattle(await api.abandonBattle(battle.id));
      onBack();
    } catch (cause) { await handleFailure(cause, 'Não foi possível desistir da batalha.'); }
    finally { inFlight.current = false; setBusy(false); }
  }

  function openSurrender() {
    if (busy || !active) return;
    surrenderDialog.current?.showModal();
  }

  function confirmSurrender() {
    surrenderDialog.current?.close();
    void surrender();
  }

  function validTarget(unit: Fighter, side: 'player' | 'enemy') {
    if (!targetAbility || !playerTurn) return false;
    if (side === 'enemy') return targetAbility.target === 'enemy' && unit.hp > 0;
    return targetAbility.target === 'defeated-ally' ? unit.hp === 0 : targetAbility.target === 'ally' && unit.hp > 0;
  }

  function actionTargets(action: BattleAction): Fighter[] {
    const ability = state.abilities[action.abilityId];
    const actorSide = state.teams.player.units.some((unit) => unit.id === action.actorId) ? 'player' : 'enemy';
    const allies = state.teams[actorSide].units;
    const enemies = state.teams[actorSide === 'player' ? 'enemy' : 'player'].units;
    const chosen = (units: Fighter[]) => units.filter((unit) => unit.id === action.targetId);
    if (!ability) return [];
    if (ability.target === 'self') return allies.filter((unit) => unit.id === action.actorId);
    if (ability.target === 'enemy') return chosen(enemies);
    if (ability.target === 'ally' || ability.target === 'defeated-ally') return chosen(allies);
    if (ability.target === 'all-enemies') return enemies.filter((unit) => unit.hp > 0);
    return allies.filter((unit) => unit.hp > 0);
  }

  function team(side: 'player' | 'enemy') {
    const player = side === 'player';
    const label = player ? 'Sua equipe' : 'Equipe inimiga';
    return <section className={`battle-team battle-team--${side}`} aria-label={label}>
      <header className="battle-team-header"><h2>{label}</h2>
        <EnergyGauge value={player ? energy : state.teams.enemy.energy} label={player ? 'Energia prevista da equipe' : 'Energia da equipe inimiga'} />
      </header>
      <div className="battle-fighters">
        {state.teams[side].units.map((unit) => {
          const chosen = queue.find((entry) => entry.actorId === unit.id) ?? (pending?.actorId === unit.id ? pending : null);
          const target = validTarget(unit, side);
          return <div key={unit.id} className={`fighter-row ${chosen ? 'fighter-row--chosen' : ''} ${pending?.actorId === unit.id ? 'fighter-row--acting' : ''} ${unit.hp <= 0 ? 'fighter-row--defeated' : ''}`}
            role="group" aria-label={`${player ? 'Aliado' : 'Inimigo'}: ${unit.name}`}>
            <div className="fighter-abilities">
              <FighterCard unit={unit} target={target} player={player}
                disabled={busy || !playerTurn || !target}
                onClick={() => pending && addAction({ ...pending, targetId: unit.id })} />
              <div className="fighter-skill-area">
                <ul className="fighter-effects" aria-label={`Efeitos ativos de ${unit.name}${player ? '' : ' (inimigo)'}`}>
                  {unit.guardExpiresAt !== null && (() => {
                    const effect = state.abilities[unit.guardAbilityId ?? 'guard'];
                    return effect ? <li><AbilityTooltip ability={effect} resetKey={tooltipReset} focusable
                      extra={`${Math.max(0, unit.guardExpiresAt - state.teams[side].turns)} turnos da equipe restantes.`}>
                      <img src={effect.icon} alt={`Efeito ativo: ${effect.name}`} />
                    </AbilityTooltip></li> : null;
                  })()}
                  {unit.invulnerableExpiresAt != null && state.abilities['fast-move'] && <li>
                    <AbilityTooltip ability={state.abilities['fast-move']} resetKey={tooltipReset} focusable
                      extra="Invulnerável no próximo turno da equipe inimiga.">
                      <img src={state.abilities['fast-move'].icon} alt="Efeito ativo: Invulnerabilidade" />
                    </AbilityTooltip>
                  </li>}
                  {unit.attackBlockedExpiresAt != null && state.abilities['dark-vortex'] && <li>
                    <AbilityTooltip ability={state.abilities['dark-vortex']} resetKey={tooltipReset} focusable
                      extra={`Impedido de atacar por ${Math.max(0, unit.attackBlockedExpiresAt - state.teams[side].turns)} turno(s) da equipe.`}>
                      <img src={state.abilities['dark-vortex'].icon} alt="Efeito ativo: ataques bloqueados" />
                    </AbilityTooltip>
                  </li>}
                  {(unit.bleedTurns ?? 0) > 0 && state.abilities['quick-slash'] && <li>
                    <AbilityTooltip ability={state.abilities['quick-slash']} resetKey={tooltipReset} focusable
                      extra={`Sangramento: ${unit.bleedAmount ?? 0} de dano por ${unit.bleedTurns} turno(s) restantes.`}>
                      <img src={state.abilities['quick-slash'].icon} alt="Efeito ativo: sangramento" />
                    </AbilityTooltip>
                  </li>}
                  {unit.damageBoostExpiresAt != null && state.abilities['internal-strength'] && <li>
                    <AbilityTooltip ability={state.abilities['internal-strength']} resetKey={tooltipReset} focusable
                      extra={`+${unit.damageBoostAmount ?? 0} de dano ${state.teams[side].turns < (unit.damageBoostStartsAt ?? 0) ? 'no próximo turno da equipe' : 'neste turno da equipe'}.`}>
                      <img src={state.abilities['internal-strength'].icon} alt="Efeito ativo: Força interna" />
                    </AbilityTooltip>
                  </li>}
                </ul>
                <div className="fighter-primary-abilities" aria-label={`Habilidades de ${unit.name}`}>
              {unit.abilityIds.map((id) => {
                const ability = state.abilities[id];
                if (!ability) return null;
                const selected = chosen?.abilityId === id;
                const noTarget = ability.target === 'defeated-ally'
                  ? !state.teams.player.units.some((entry) => entry.hp === 0)
                  : ability.target === 'enemy' ? !state.teams.enemy.units.some((entry) => entry.hp > 0) : false;
                const disabled = !player || busy || !playerTurn || unit.hp <= 0
                  || (!!chosen && !selected) || (!!pending && pending.actorId !== unit.id)
                  || (!selected && (ability.energyCost > energy || noTarget));
                return <AbilityTooltip key={id} ability={ability} resetKey={tooltipReset} focusable={disabled}>
                  <button type="button" className="battle-skill" disabled={disabled}
                  aria-label={`${ability.name} — ${unit.name}${player ? '' : ' (inimigo)'}`}
                  aria-pressed={player ? selected : undefined} onClick={() => chooseAbility(unit, ability)}>
                    <img src={ability.icon} alt="" />
                  </button>
                </AbilityTooltip>;
              })}
                </div>
              </div>
            </div>
          </div>;
        })}
      </div>
    </section>;
  }

  return <main className={`battle-page${targetingEnemy ? ' battle-page--targeting' : ''}`} style={{ backgroundImage: `linear-gradient(#12312918, #12312945), url("${finalBattle ? assets.finalBattle : assets.battle}")` }}>
    <header className="battle-header">
      <div className="battle-heading"><h1>{title}</h1><p>Turno {state.turn} · {active ? state.activeSide === 'player' ? 'Sua vez' : battle.botActsAt ? 'Turno do BOT COM' : 'Turno do adversário' : state.status === 'victory' ? 'Vitória' : state.status === 'abandoned' ? 'Desistência' : 'Derrota'}</p></div>
      {active && <div className="battle-turn-controls">
        <button type="button" className="fantasy-button battle-end-turn" disabled={busy || !playerTurn || !!pending || !!queueError}
          aria-label={`${busy ? 'Aguarde' : turnLabel} ${remaining}s`} onClick={confirmTurn}>
          {busy ? 'Aguarde…' : turnLabel}{' '}
          <span className="battle-turn-clock" role="timer" aria-label="Tempo restante do turno">{remaining}s</span>
        </button>
      </div>}
    </header>
    <button type="button" className="battle-log-toggle" onClick={() => logDialog.current?.showModal()}>Registro do combate</button>

    <div className="battle-arena" aria-label="Campo de batalha">
      {team('player')}
      <section className="battle-combo" aria-label="Combo do turno"><h2>Combo do turno</h2>
        {comboActions.length > 0 && <ol>{comboActions.map((action, index) => {
          const actor = state.teams.player.units.find((unit) => unit.id === action.actorId)
            ?? state.teams.enemy.units.find((unit) => unit.id === action.actorId);
          const ability = state.abilities[action.abilityId];
          const targets = actionTargets(action);
          const removable = queue.some((entry) => entry.actorId === action.actorId);
          return <ActionRow key={action.actorId} actor={actor} ability={ability} targets={targets}
            className={state.activeSide === 'enemy' ? 'battle-combo-entry--enemy' : undefined}
            remove={removable ? { label: `Remover ação ${index + 1}`, disabled: busy || !playerTurn, onClick: () => requestRemoveAction(action.actorId) } : undefined} />;
        })}</ol>}
        {comboActions.length === 0 && finalComboEntries.length > 0 && <ol>
          {finalComboEntries.map((entry) => <ActionRow key={entry.actionId} actor={entry.actor} ability={entry.ability} targets={entry.targets}
            className={entry.side === 'enemy' ? 'battle-combo-entry--enemy' : undefined} />)}
        </ol>}
        {comboActions.length === 0 && finalComboEntries.length === 0 &&
          <p>{!active ? 'Batalha encerrada.' : enemyTurn ? 'Aguardando ações do inimigo…' : 'Nenhuma ação selecionada.'}</p>}
      </section>
      {team('enemy')}
    </div>

    {active && <>
      {playerTurn && pending && targetAbility && <p className="battle-target-hint" role="status">Escolha {targetAbility.target === 'defeated-ally' ? 'um aliado derrotado' : 'um aliado'} para {targetAbility.name}.</p>}
      <button type="button" className="battle-surrender" disabled={busy} onClick={openSurrender}>Desistir</button>
    </>}
    {queueError && <p className="battle-feedback feedback" role="alert">{queueError}</p>}
    {error && <p className="battle-feedback feedback" role="alert">{error}</p>}
    {!active && <section className="battle-result" aria-label="Resultado da batalha">
      <h2>{state.status === 'victory' ? 'Vitória!' : state.status === 'abandoned' ? 'Batalha encerrada' : 'Derrota'}</h2>
      <p>{state.status === 'abandoned' ? 'A batalha foi encerrada. A próxima tentativa começará do zero.'
        : quickBattle ? 'O resultado da Batalha rápida foi salvo. Prepare-se para um novo confronto.'
          : state.status === 'victory' ? 'O resultado foi salvo. Continue a jornada pelo mapa.' : 'Reorganize sua equipe e tente novamente pelo mapa.'}</p>
      <button className="fantasy-button compact" onClick={onBack}>{quickBattle ? 'Voltar à Batalha rápida' : 'Continuar no mapa'}</button>
    </section>}

    <dialog ref={logDialog} className="battle-log-dialog" aria-labelledby="battle-log-title">
      <header><h2 id="battle-log-title">Registro do combate</h2>
        <button type="button" onClick={() => logDialog.current?.close()} aria-label="Fechar registro do combate">×</button>
      </header>
      <div className="battle-log-scroll" tabIndex={0} role="region" aria-label="Eventos da batalha">
        {events.filter((event) => event.kind === 'transform').map((event, index) => <p className="battle-transformation" key={index}>{event.message}</p>)}
        {logGroups.length ? logGroups.map((group) => <section className="battle-log-turn" key={group.turn ?? 'other'}>
          <h3>{group.turn === null ? 'Ações anteriores' : `Turno ${group.turn}`}</h3>
          <ol>{group.entries.map((entry) => <ActionRow key={entry.actionId}
            className={entry.side === 'enemy' ? 'battle-log-entry--enemy' : undefined}
            actor={entry.actor} ability={entry.ability} targets={entry.targets} />)}</ol>
        </section>)
          : <p>A batalha começou. As ações resolvidas aparecerão aqui.</p>}
      </div>
    </dialog>

    <dialog ref={surrenderDialog} className="battle-confirm-dialog" aria-labelledby="surrender-title" aria-describedby="surrender-description">
      <h2 id="surrender-title">Desistir da batalha?</h2>
      <p id="surrender-description">A batalha será encerrada e a próxima tentativa começará do zero.</p>
      <div className="battle-confirm-actions">
        <button type="button" onClick={() => surrenderDialog.current?.close()}>Continuar na batalha</button>
        <button type="button" className="battle-confirm-danger" disabled={busy} onClick={confirmSurrender}>Confirmar desistência</button>
      </div>
    </dialog>

    <dialog ref={dependencyDialog} className="battle-confirm-dialog" aria-labelledby="dependency-title" aria-describedby="dependency-description">
      <h2 id="dependency-title">Não é possível remover a ação</h2>
      <p id="dependency-description">
        {dependencyWarning ? `Remover "${dependencyWarning.removed}" deixaria estas habilidades sem energia. Remova primeiro as ações dependentes:` : 'Remova primeiro as ações dependentes.'}
      </p>
      {dependencyWarning && dependencyWarning.dependents.length > 0 && <ul className="battle-dependency-list">
        {dependencyWarning.dependents.map((dependent) => <li key={dependent}>{dependent}</li>)}
      </ul>}
      <div className="battle-confirm-actions">
        <button type="button" onClick={() => dependencyDialog.current?.close()}>Entendi</button>
      </div>
    </dialog>
  </main>;
}

function buildLogEntries(events: BattleEvent[], state: BattleRecord['state']) {
  const groups = new Map<string, { actionId: string; actorId: string; abilityId: string; targetIds: string[] }>();
  for (const event of events) {
    if (!event.actionId || !event.actorId || !event.abilityId) continue;
    const group = groups.get(event.actionId);
    if (!group) {
      groups.set(event.actionId, { actionId: event.actionId, actorId: event.actorId, abilityId: event.abilityId, targetIds: [...(event.targetIds ?? [])] });
      continue;
    }
    for (const targetId of event.targetIds ?? []) if (!group.targetIds.includes(targetId)) group.targetIds.push(targetId);
  }
  const fighters = [...state.teams.player.units, ...state.teams.enemy.units];
  return [...groups.values()].flatMap((group) => {
    const actor = fighters.find((unit) => unit.id === group.actorId);
    const ability = state.abilities[group.abilityId];
    if (!actor || !ability) return [];
    const targets = group.targetIds.map((id) => fighters.find((unit) => unit.id === id)).filter((unit): unit is Fighter => !!unit);
    const side = state.teams.player.units.some((unit) => unit.id === actor.id) ? 'player' as const : 'enemy' as const;
    return [{ ...group, side, actor, ability, targets }];
  });
}

type LogEntry = ReturnType<typeof buildLogEntries>[number];

function groupLogEntries(entries: LogEntry[]) {
  const groups = new Map<number | null, LogEntry[]>();
  for (const entry of entries) {
    const parts = entry.actionId.split(':');
    const turn = parts.length >= 3 && Number.isInteger(Number(parts[1])) ? Number(parts[1]) : null;
    const group = groups.get(turn) ?? [];
    group.push(entry);
    groups.set(turn, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left === right ? 0 : left === null ? 1 : right === null ? -1 : right - left)
    .map(([turn, group]) => ({ turn, entries: [...group].reverse() }));
}

function ActionRow({ actor, ability, targets, remove, className }: {
  actor?: Fighter; ability?: AbilityDefinition; targets: Fighter[]; className?: string;
  remove?: { label: string; disabled: boolean; onClick: () => void };
}) {
  return <li className={className}>
    <img className="combo-actor" src={actor?.portrait} alt={actor?.name} />
    <img className="combo-ability" src={ability?.icon} alt={ability?.name} />
    {targets.length > 0 && <>
      <span className="combo-arrow" aria-hidden="true">→</span>
      <span className="combo-targets">
        {targets.map((target) => <img key={target.id} src={target.portrait} alt={`Alvo: ${target.name}`} />)}
      </span>
    </>}
    {remove && <button type="button" disabled={remove.disabled} onClick={remove.onClick} aria-label={remove.label}>×</button>}
  </li>;
}

function EnergyGauge({ value, label }: { value: number; label: string }) {
  return <div className="battle-energy"><span>Energia <strong>{value} / 100</strong></span>
    <div className="energy-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span style={{ width: `${value}%` }} />
    </div>
  </div>;
}

function FighterCard({ unit, target, player, disabled, onClick }: { unit: Fighter; target: boolean; player: boolean; disabled: boolean; onClick: () => void }) {
  return <button type="button" className={`fighter-card ${target ? 'fighter-card--target' : ''} ${unit.hp <= 0 ? 'fighter-card--defeated' : ''}`}
    disabled={disabled} aria-label={`${target ? 'Alvo' : player ? 'Personagem' : 'Adversário'}: ${unit.name}`} onClick={onClick}>
    <span className="fighter-portrait">
      <img src={unit.portrait} alt="" />
      {unit.hp <= 0 && <svg className="fighter-defeated-mark" viewBox="0 0 100 100" aria-hidden="true">
        <path className="fighter-defeated-mark-shadow" d="M18 18 82 82M82 18 18 82" />
        <path d="M18 18 82 82M82 18 18 82" />
      </svg>}
    </span>
    <span className={`hp-track${unit.hp <= 30 ? ' hp-track--critical' : unit.hp <= 65 ? ' hp-track--warning' : ''}`} role="progressbar" aria-label={`HP de ${unit.name}${player ? '' : ' (inimigo)'}`} aria-valuemin={0} aria-valuemax={unit.maxHp} aria-valuenow={unit.hp}>
      <span style={{ width: `${100 * unit.hp / unit.maxHp}%` }} /><b>{unit.hp} / {unit.maxHp}</b>
    </span>
  </button>;
}
