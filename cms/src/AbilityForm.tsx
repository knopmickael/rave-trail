import { useEffect, useState } from 'react';
import type { AbilityDefinition, AbilityEffect } from '../../shared/src/content/abilities';
import { effectSpecs, targets, type AiProposal, type Catalog } from '../contracts';
import { ImageField, NumberField, Select, Text } from './fields';
import { request } from './api';

export function AbilityForm({ value: a, onChange, catalog, aiReady }: {
  value: AbilityDefinition; onChange: (value: AbilityDefinition) => void; catalog: Catalog; aiReady: boolean;
}) {
  const update = (patch: Partial<AbilityDefinition>) => onChange({ ...a, ...patch });
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [prompt, setPrompt] = useState('');
  const [proposal, setProposal] = useState<AiProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { setMessages([]); setProposal(null); setPrompt(''); setError(''); }, [a.id]);
  async function chat() {
    if (!prompt.trim() || busy) return;
    setBusy(true); setError(''); setProposal(null);
    const next = [...messages, { role: 'user' as const, content: prompt }].slice(-23);
    setMessages(next); setPrompt('');
    try {
      const result = await request<AiProposal>('/api/ai/chat', 'POST', { messages: next, ability: {
        ...a, id: a.id || 'nova-habilidade', name: a.name || 'Nova habilidade', description: a.description || 'Rascunho em elaboração.',
        icon: a.icon || '/media/abilities/guard.jpg',
      } });
      setProposal(result); setMessages([...next, { role: 'assistant', content: JSON.stringify(result) }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao consultar IA.'); }
    finally { setBusy(false); }
  }
  return <>
    <section className="form-section"><div className="section-heading"><span>01</span><h3>Identidade da habilidade</h3></div>
      <Text label="Nome da habilidade" value={a.name} onChange={(name) => update({ name })} /><Text label="Descrição textual" multiline value={a.description} onChange={(description) => update({ description })} />
      <ImageField label="Imagem da habilidade" value={a.icon} onChange={(icon) => update({ icon })} />
    </section>
    <section className="form-section"><div className="section-heading"><span>02</span><h3>Comportamento em batalha</h3></div>
      <div className="segmented" aria-label="Modo de configuração"><button type="button" aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>⌘ Configuração manual</button><button type="button" aria-pressed={mode === 'ai'} onClick={() => setMode('ai')}>✧ Assistente de IA</button></div>
      {mode === 'manual' ? <>
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
            value={(effect as unknown as Record<string, number>)[field]} onChange={(number) => update({ effects: a.effects.map((e, i) => i === index ? { ...e, [field]: number } : e) })} />)}</div>
        </fieldset>)}
        <button type="button" className="secondary" disabled={a.effects.length >= 12} onClick={() => update({ effects: [...a.effects, { kind: 'damage', amount: 20 }] })}>+ Combinar outro efeito</button>
      </> : <div className="ai-panel">
        <div className="ai-intro"><span aria-hidden="true">✧</span><div><h4>Descreva a habilidade. Vamos montar os efeitos.</h4><p>O assistente conhece o contrato real do combate. Converse para ajustar custo, alvo e intensidade.</p></div></div>
        {!aiReady && <p className="callout">Para ativar o chat, configure CMS_AI_BASE_URL, CMS_AI_MODEL e, se necessário, CMS_AI_API_KEY no arquivo de ambiente do perfil escolhido. Reinicie a API do CMS.</p>}
        <div className="chat-history" role="log" aria-label="Conversa sobre a habilidade">{messages.map((message, index) => {
          let content = message.content;
          if (message.role === 'assistant') { try { content = (JSON.parse(content) as AiProposal).message; } catch { /* Texto simples. */ } }
          return <div key={index} className={`chat-message ${message.role}`}><strong>{message.role === 'user' ? 'Você' : 'Assistente'}</strong><p>{content}</p></div>;
        })}{busy && <p role="status">Elaborando a configuração…</p>}</div>
        <Text label="Descreva ou refine a habilidade" multiline required={false} value={prompt} onChange={setPrompt} hint="Ex.: golpe em todos os inimigos com 15 de dano e sangramento de 5 por 2 turnos; custo 40." />
        <button type="button" className="primary" disabled={!aiReady || busy || !prompt.trim()} onClick={() => { void chat(); }}>✧ Enviar descrição</button>
        {proposal?.ability && <div className="proposal"><h4>Configuração proposta</h4><p>{proposal.ability.name} · {proposal.ability.energyCost} energia · {targets[proposal.ability.target]}</p><pre>{JSON.stringify(proposal.ability.effects, null, 2)}</pre>
          <button type="button" className="secondary" onClick={() => {
            if (!proposal.ability || !window.confirm('Aplicar a proposta de IA ao formulário da habilidade?')) return;
            onChange({ ...proposal.ability, id: a.id || proposal.ability.id, icon: a.icon || proposal.ability.icon }); setMode('manual'); setNotice('Proposta aplicada ao rascunho. Revise e salve a habilidade.');
          }}>Aplicar ao formulário</button></div>}
        {proposal?.engineExtension && <div className="extension"><h4>Extensão do motor necessária · {proposal.engineExtension.summary}</h4><p>{proposal.engineExtension.reason}</p><pre>{proposal.engineExtension.suggestedConfig}</pre>
          <button type="button" className="secondary" onClick={() => {
            const blob = new Blob([JSON.stringify(proposal, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'proposta-extensao-habilidade.json'; link.click(); URL.revokeObjectURL(link.href);
          }}>Exportar especificação técnica</button><p className="muted">A proposta precisa ser implementada e testada no motor antes de virar uma habilidade executável.</p></div>}
      </div>}
      {error && <p className="error" role="alert">{error}</p>}{notice && <p className="success" role="status">{notice}</p>}
    </section>
    <section className="form-section"><div className="section-heading"><span>03</span><h3>Onde esta habilidade aparece</h3></div><p className="muted">{catalog.characters.filter((c) => c.abilityIds.includes(a.id)).map((c) => c.name).join(' · ') || 'Nenhum personagem vinculado ainda.'}</p></section>
  </>;
}
