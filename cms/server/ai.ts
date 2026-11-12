import { z } from 'zod';
import { effectSpecs, targets } from '../contracts.js';
import { abilitySchema, proposalSchema } from './schemas.js';
import { CmsError } from './repository.js';
import { cmsEnvironmentFile } from '../environment.js';

export const chatSchema = z.object({ messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(12000) }).strict()).min(1).max(24),
  ability: abilitySchema.nullable() }).strict();

export async function suggestAbility(input: z.infer<typeof chatSchema>) {
  const base = process.env.CMS_AI_BASE_URL;
  const model = process.env.CMS_AI_MODEL;
  if (!base || !model) throw new CmsError(503, `Configure CMS_AI_BASE_URL e CMS_AI_MODEL no ${cmsEnvironmentFile()}.`);
  const url = new URL(base);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new CmsError(400, 'O provedor de IA deve usar HTTPS ou localhost.');
  const system = `Você é o assistente de autoria do JRPG Rave Trail. Responda em português com um objeto JSON, sem markdown, no formato:
{"message":"explicação da proposta ou pergunta de esclarecimento", "ability":null ou {"id":"slug", "name":"nome", "description":"texto fiel aos efeitos", "energyCost":0, "target":"self", "effects":[], "icon":"/media/abilities/guard.jpg"}, "engineExtension":null ou {"summary":"mecânica inédita", "reason":"por que não é representável", "suggestedConfig":"proposta de contrato e comportamento a implementar no motor, como texto"}}.
Alvos suportados: ${JSON.stringify(targets)}. Efeitos e seus campos/limites: ${JSON.stringify(effectSpecs)}.
Pode combinar efeitos compatíveis no mesmo alvo e criar setups novos usando este contrato. Ataque/dreno/sangramento/bloqueio: enemy ou all-enemies; cura/guarda/invulnerabilidade/bônus: ally/self/all-allies; revive: defeated-ally; energia/turno extra: team. Custo inteiro 0–100. Exatamente os campos indicados; não invente kind, target ou campos executáveis. Buff de ataque só vale a partir do próximo turno. Dreno cura o usuário pelo dano real. Guarda é redução fixa, não percentual. Efeitos são sequenciais e usam um único alvo comum.
Quando não houver representação fiel (ex.: stun total, alvo misto, condição específica, efeito passivo), devolva ability:null e engineExtension com um plano técnico; não simule a mecânica por uma habilidade diferente. Nunca execute código/SQL nem alegue ter alterado o motor. Pode pedir esclarecimentos com ambos null. Mantenha ID e imagem do rascunho quando existirem. Não aplique alterações automaticamente.
Rascunho atual: ${JSON.stringify(input.ability)}`;
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.CMS_AI_API_KEY ? { Authorization: `Bearer ${process.env.CMS_AI_API_KEY}` } : {}) },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...input.messages], response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(90000), redirect: 'error',
    });
  } catch { throw new CmsError(502, 'Não foi possível consultar o modelo. Verifique o provedor e tente novamente.'); }
  if (!response.ok) throw new CmsError(502, `O provedor de IA respondeu HTTP ${response.status}. Verifique modelo, chave e cota.`);
  const body = await response.text();
  if (body.length > 200000) throw new CmsError(502, 'Resposta do modelo excedeu o limite.');
  try {
    const result = JSON.parse(body) as { choices?: { message?: { content?: string } }[] };
    const parsed = proposalSchema.parse(JSON.parse(result.choices?.[0]?.message?.content ?? ''));
    if (parsed.engineExtension && parsed.ability) throw new Error('Proposta ambígua.');
    return parsed;
  } catch { throw new CmsError(502, 'O modelo retornou uma configuração inválida ou incompatível com o motor. Refine a descrição e tente novamente.'); }
}
