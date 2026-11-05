# Monitoramento

Observabilidade "desde o berço" para a Rave Trail, mantendo o custo em zero na
escala de uma instância Lightsail. O foco é detectar, cedo, os três sintomas de
demanda que afetam um box único — CPU/RAM, banco e latência/erros — além do disco
cheio.

Três peças compõem o monitoramento inicial:

1. Alarmes nativos do Lightsail (CPU + burst capacity).
2. Health check externo apontando para `/api/health`.
3. Endpoint `/api/health` na aplicação (já implementado).

Mais rotação de logs no Docker, para o disco não encher.

## 1. Alarmes nativos do Lightsail

O Lightsail traz métricas e alarmes por e-mail sem custo e sem agente. Configure no
console: instância `rave-trail` → aba **Metrics**.

Crie dois alarmes:

| Métrica | Condição sugerida | Por quê |
|---|---|---|
| **CPU utilization** | `> 80%` por 5 min | Demanda acima do que o box aguenta |
| **CPU burst capacity** | `< 20%` (ou "saldo baixo") | No plano de US$5 a CPU é *burstable*; quando o saldo de burst acaba, a instância afoga mesmo com %CPU parecendo normal. **Este é o alarme que melhor indica demanda sustentada.** |

Ambos notificam por e-mail. É o mínimo absoluto e cobre o sintoma CPU/RAM.

## 2. Health check externo

Um monitor **fora** da AWS que bate em `https://rave-trail.com.br/api/health` a
cada 1–5 minutos e avisa se cair ou ficar lento. Externo porque, se a instância
morre, nada que roda dentro dela consegue te alertar.

Serviços com plano grátis suficiente para um endpoint: UptimeRobot, BetterStack,
Healthchecks.io. Configuração típica:

- URL: `https://rave-trail.com.br/api/health`
- Intervalo: 1–5 min
- Sucesso: HTTP **200**
- Alerta: e-mail/Telegram quando status ≠ 200 ou timeout

Esse é o melhor custo-benefício: responde "a app está no ar e o banco responde?".

## 3. Endpoint `/api/health` (implementado)

Rota pública e leve em `backend/src/app.ts`:

- `GET /api/health`
- Executa `SELECT 1` no PostgreSQL (verificação injetada pelo `index.ts`).
- **200** `{"status":"ok","database":"up"}` quando o banco responde.
- **503** `{"status":"error","database":"down"}` quando o banco falha — assim o
  monitor externo diferencia "processo vivo mas banco caído" de "app fora do ar".

Não exige autenticação e não expõe dados. O hook global já aplica
`Cache-Control: no-store`, então o monitor sempre vê o estado atual.

Teste manual após o deploy:

```bash
curl -i https://rave-trail.com.br/api/health
```

## Rotação de logs (implementada)

`deploy/docker-compose.prod.yaml` aplica a todos os serviços:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

Cada container guarda no máximo ~30 MB de log (3 × 10 MB) e descarta o mais
antigo. Evita a falha boba de o disco encher de log e derrubar o box. Para ler os
logs em produção, ver `runbook.md`.

## Quando é hora de sair do Lightsail

Sinais concretos, vindos dos itens acima:

- **CPU burst capacity** esgotando com regularidade (alarme do item 1 disparando
  repetidamente) → demanda sustentada acima do plano.
- **RAM** batendo no teto — Node + Postgres + Caddy competem por 1 GB. Confira com
  `docker stats` na instância.
- **Latência** subindo no health check externo mesmo com CPU/RAM folgados →
  provável saturação do banco (conexões do pool, falta de índice).

Primeira resposta, barata: **subir o plano** do Lightsail (passo a passo no
`runbook.md`). Resposta estrutural, quando um box não basta: migrar para
ECS/RDS com IaC — momento em que vale o AWS CDK em Python.

## Fora de escopo agora (fase 2)

Error tracking (Sentry) e logs/métricas centralizados (CloudWatch, Grafana Cloud)
não foram configurados de propósito: na escala atual, acrescentam custo e/ou
competem por RAM com a própria app. Reavalie quando os gatilhos de migração acima
começarem a aparecer.
