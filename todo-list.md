# Novo balanceamento de habilidades

- Execução
    - Novo custo: 50 de energia
- Recuperar muita vida
    - Novo custo: 50 de energia

# Novo comportamento na interface da batalha

Ao passar o mouse por qualquer habilidade (tanto inimiga quanto aliada) o cursor deve mudar para o tipo hover e o tempo para aparecer o tooltip com a descrição da skill pode ser 0.25s ao invés de 0.5s

## Implementação

- [x] Execução e Recuperar muita vida com custo de 50 de energia.
- [x] Tooltip após 250 ms, com cursor de interação em habilidades aliadas e inimigas, inclusive desabilitadas.
- [x] Migration `049_execution_and_heal_plus_energy.sql` aplicada no banco local e pronta para a esteira de produção.
