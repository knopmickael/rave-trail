$projeto = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path

Set-Location $projeto

$prompt = @"
Leia o arquivo todo-list.md na raiz do projeto.

Execute as tarefas pendentes na ordem definida.

Regras:
1. Execute uma tarefa por vez.
2. Respeite as dependências entre tarefas.
3. Siga a arquitetura existente.
4. Execute os testes após cada implementação.
5. Atualize docs/implementation-tasks.md marcando tarefas concluídas.
6. Não marque tarefas que falharam.
7. Não execute operações destrutivas.
8. Continue até finalizar as tarefas ou encontrar
   um impedimento que não consiga resolver.
"@

$logDirectory = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
opencode run --agent build $prompt 2>&1 |
    Out-File (Join-Path $logDirectory "opencode-night.log") -Encoding utf8
