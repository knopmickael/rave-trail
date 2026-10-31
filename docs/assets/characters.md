# Imagens de personagens

Os 38 PNGs das 19 unidades ficam em `frontend/public/media/characters/`. Cada unidade possui:

- `<nome-do-personagem>-face.png`: retrato.
- `<nome-do-personagem>-body.png`: ilustração de corpo inteiro.

Os nomes são derivados do nome de exibição, em minúsculas, sem acentos e com hífens. Os caminhos são persistidos em `units.portrait_path` e `units.illustration_path`; a interface utiliza esses campos do catálogo, sem deduzir imagens pelo ID.

| ID estável | Prefixo das imagens |
|---|---|
| `protagonist-main-base` | `ravi-de-berdal` |
| `protagonist-secondary-base` | `doko-de-berdal` |
| `protagonist-female-base` | `anna-de-berdal` |
| `road-raider-1-base` | `saqueador-da-estrada-i` |
| `road-raider-2-base` | `saqueador-da-estrada-ii` |
| `road-raider-3-base` | `saqueadora-da-estrada` |
| `rival-a-base` | `jung-de-grimoria` |
| `jung-de-grimoria-ii` | `jung-de-grimoria-ii` |
| `rival-b-base` | `exal-de-grimoria` |
| `rival-female-base` | `monnica-de-grimoria` |
| `guardian-healer-male-base` | `curandeiro-de-pontes` |
| `guardian-healer-female-base` | `curandeira-de-pontes` |
| `passage-guardian-base` | `drak-de-pontes` |
| `guerreiros-habilidosos-a` | `trinity-de-espinea` |
| `guerreiros-habilidosos-b` | `vlade-de-espinea` |
| `guerreiros-habilidosos-c` | `passago-de-espinea` |
| `protagonist-main-transformed` | `ravi-berserk` |
| `rival-b-final-mode` | `exal-verdadeiro-poder` |
| `legendary-beast-premium` | `fera-lendaria` |

As artes fornecidas para Jung II foram incorporadas como `jung-de-grimoria-ii-face.png` e `jung-de-grimoria-ii-body.png`. A renomeação preservou os hashes SHA-256 de todos os 38 arquivos.

A migração 021 atualiza os caminhos do catálogo, dos snapshots de batalhas, da transformação de Ravi e das respostas idempotentes de turnos. Os IDs, HP, energia, resultados, revisões e datas das batalhas são preservados.

`tools/assets/generate-mock-art.mjs` é a ferramenta opcional para gerar arte mockada e utiliza os caminhos atuais do catálogo compartilhado. Novas artes ou renomeações precisam manter as referências de arquivos e banco consistentes; os testes de arquitetura também conferem existência e capitalização dos nomes em disco.
