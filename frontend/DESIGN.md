---
version: 1
name: ERP — sistema de design
description: "Base: análise do Supabase (awesome-design-md) — canvas quase monocromático, um único acento verde-esmeralda com tinta escura por cima, UI densa de produto. Emprestado do SAP: a moldura de aplicação (barra lateral clara + topo de 56px com hairline) para que a tela leia como ferramenta de trabalho, não site. Mudanças: neutros levemente quentes para reduzir o brilho em uso prolongado, escala display reduzida para app, tema escuro derivado da escada de superfícies, semânticas completas para status de venda, NF-e e títulos."

colors:
  canvas: "#f7f7f5"
  surface: "#ffffff"
  surface-2: "#f2f2ef"
  surface-3: "#e9e9e5"
  hairline: "#e4e3de"
  hairline-strong: "#d2d1ca"
  ink: "#171717"
  ink-2: "#4a4a4f"
  ink-3: "#77777e"
  primary: "#3ecf8e"
  primary-hover: "#36bd80"
  primary-press: "#2fa871"
  on-primary: "#06291a"
  accent-ink: "#0f7a4b"
  success: "#15803d"
  success-soft: "#e6f6ec"
  warning: "#a15c07"
  warning-soft: "#fdf2d8"
  danger: "#c81e1e"
  danger-soft: "#fdeaea"
  info: "#1d4ed8"
  info-soft: "#e8eefd"
  neutral-soft: "#efefec"
dark:
  canvas: "#0e0e0e"
  surface: "#161616"
  surface-2: "#1d1d1d"
  surface-3: "#262626"
  hairline: "#2a2a2a"
  hairline-strong: "#3a3a3a"
  ink: "#ededed"
  ink-2: "#b3b3b3"
  ink-3: "#8b8b8b"
  accent-ink: "#4ade9b"

typography:
  ui: "Inter (substituto livre da sans custom do Supabase), system-ui"
  mono: "JetBrains Mono — SKUs, chaves de acesso, protocolos, IDs"
  page-title: 26px / 600 / -0.4px
  section: 16px / 600 / -0.1px
  body: 14px / 400 / 1.5
  body-sm: 13px / 400
  label: 12px / 500
  kpi: 30px / 600 / -0.6px, tabular-nums

spacing: "base 4px — 4, 8, 12, 16, 20, 24, 32, 40, 48"
rounded: "sm 6px (badges, inputs pequenos) · md 8px (botões, inputs) · lg 12px (cards, drawers) · pill 999px (status)"
elevation: "superfície + hairline; sombra só em menu, popover, modal, drawer e toast"
---

## Overview

Tela de trabalho para operadores de loja e gestores. Quase tudo neutro; o verde aparece no botão
primário, no item ativo da navegação, no foco e na série principal dos gráficos. Status falam por badges
semânticos com fundo suave. Números são tabulares e alinhados à direita.

## Components

- **Botões:** `primary` (verde, tinta escura, um por vista), `secondary` (superfície + hairline),
  `ghost` (sem borda, para ações de linha), `danger` (vermelho, só em confirmação destrutiva).
  36px de altura (32px `sm`). Hover sobe 1px; press afunda e `scale(.985)`.
- **Inputs:** 36px, hairline-strong, foco com borda de acento + anel suave de 3px.
- **Badges de status:** pill, 12px/500, fundo `-soft` e texto da cor semântica.
  ORCAMENTO → neutro · CONFIRMADA → info · FATURADA/PAGO/AUTORIZADA/RECEBIDO → success ·
  ABERTO → warning (vencido → danger) · CANCELADA/REJEITADA → danger.
- **Tabela:** cabeçalho 12px/500 ink-3 sobre surface-2, linhas de 44px, hover surface-2.
- **Card:** surface, hairline, raio 12, padding 20.
- **Drawer:** 520px à direita, para criar/editar sem sair da lista.
- **KPI:** rótulo 12px, valor 30px tabular, linha de contexto 12px.

## Do's and Don'ts

- Do: um botão primário por vista; criar/editar em drawer; formatos pt-BR; status sempre em badge.
- Don't: gradientes, sombras em cards em repouso, roxo, ícones coloridos na navegação,
  texto abaixo de 12px, animação ao rolar.
