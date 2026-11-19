# ERP — frontend

React 19 + TypeScript + Vite, sem bibliotecas de UI: o sistema de design está em `DESIGN.md`
(base Supabase + moldura de aplicação do SAP, via awesome-design-md) e virou tokens em `src/styles/tokens.css`.

## Rodar

Com Docker (junto com o backend): na raiz do projeto, `docker compose up --build` → http://localhost:3000

Em desenvolvimento (hot reload), com o backend rodando na porta 8080:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (encaminha /api para :8080)
```

## Estrutura

```
src/
  styles/      tokens.css (cores, raios, tipos, movimento; claro e escuro) e app.css
  lib/         api (fetch + JWT + erros), auth, router por hash, hooks, formatos pt-BR, tipos
  components/  ui (botões, campos, badges, estados), overlay (drawer, modal, toast), charts,
               Shell (menu lateral, Ctrl+K), pickers, pessoa (CPF/CNPJ + CEP via ViaCEP)
  pages/       Dashboard, Pdv, Vendas, Produtos, Estoque, Compras, Clientes, Fornecedores,
               Notas, Financeiro, Relatorios, Empresa, Usuarios, Conta, Login
```

Atalhos: `Ctrl+K` busca global · `F2` abre o PDV · `/` foca a busca do PDV · `F9` finaliza a venda.
