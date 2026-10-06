<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Skills do projeto

- Aplique `.agents/skills/ponytail/SKILL.md` nas tarefas de código: leia os
  chamadores, reutilize funções existentes e preserve validação, segurança e
  os requisitos do produto. Não substitua as regras deste arquivo ou de CLAUDE.md.
- Ao instalar ou atualizar skills, siga `.agents/skills/agent-skills/SKILL.md`
  e valide o formato com a ferramenta oficial de referência. Estas skills
  fazem parte do repositório e devem acompanhar suas próximas versões.
- A rota de IA é serviço de servidor; não coloque segredos em VITE_* nem no
  navegador. Configuração e verificação em `docs/omni-router.md`.
