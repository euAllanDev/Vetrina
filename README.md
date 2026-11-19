# Vetrina

Sistema de gestão (estoque, vendas/PDV, compras, NF-e, financeiro e relatórios) com loja online própria. Java 21 + Spring Boot 3 no backend, React no frontend.

## Backend: Java 21 + Spring Boot 3

Backend de gestão para empresas: **estoque, vendas/PDV, compras, NF-e, financeiro, relatórios**, com autenticação JWT e perfis de acesso.

## Como rodar

Pré-requisito: Docker Desktop.

```bash
docker compose up --build
```

- API: http://localhost:8080
- Swagger (documentação interativa): http://localhost:8080/swagger-ui.html
- Login inicial: `admin@erp.com` / `admin123`
- Postgres exposto em `localhost:5433` (usuário/senha/banco: `erp`)

Teste de ponta a ponta (PowerShell, com a aplicação rodando):

```powershell
.\scripts\smoke-test.ps1
```

Para rodar fora do Docker (IntelliJ): suba só o banco com `docker compose up db`, e rode `ErpApplication` com
`DB_URL=jdbc:postgresql://localhost:5433/erp`.

## Módulos

| Módulo | Rotas | O que faz |
|---|---|---|
| Autenticação | `/api/auth` | Login (JWT), dados do usuário logado, troca de senha |
| Usuários | `/api/usuarios` | CRUD de usuários (somente ADMIN) |
| Empresa | `/api/empresa` | Dados do emitente da NF-e (CNPJ, IE, CRT, endereço, série, numeração, ambiente) |
| Produtos | `/api/produtos`, `/api/categorias` | Cadastro com dados fiscais (NCM, CEST, CFOP, CST/CSOSN, alíquotas), busca, estoque baixo |
| Estoque | `/api/estoque` | Kardex (movimentações), inventário, entradas/saídas manuais, valor do estoque; custo médio ponderado |
| Clientes | `/api/clientes` | PF/PJ com validação de CPF/CNPJ (inclui CNPJ alfanumérico), limite de crédito |
| Fornecedores | `/api/fornecedores` | Cadastro de fornecedores |
| Compras | `/api/compras` | Pedido de compra → recebimento (entrada no estoque com frete rateado no custo + contas a pagar parceladas) |
| Vendas | `/api/vendas` | Orçamento → confirmação (baixa estoque + contas a receber), PDV em um passo, cancelamento com estorno |
| NF-e | `/api/notas-fiscais` | Emissão a partir da venda, cálculo de tributos, chave de acesso, XML 4.00, cancelamento, download do XML |
| Financeiro | `/api/financeiro` | Contas a receber/pagar, baixa, cancelamento, títulos vencidos, fluxo de caixa |
| Relatórios | `/api/dashboard`, `/api/relatorios` | Dashboard, vendas por dia, mais vendidos, curva ABC com lucro bruto |

## Perfis

`ADMIN` (tudo), `GERENTE` (tudo menos usuários/empresa), `VENDEDOR` (vendas, clientes, NF-e), `ESTOQUISTA` (produtos, estoque, compras, fornecedores), `FINANCEIRO` (financeiro, fornecedores, NF-e).

## Fluxos principais

**Venda:** `POST /api/vendas` cria orçamento → `POST /api/vendas/{id}/confirmar` baixa o estoque e gera os títulos
(à vista: título já quitado; a prazo: parcelas mensais) → `POST /api/notas-fiscais {vendaId}` emite a NF-e e a venda vira `FATURADA`.
Balcão: `POST /api/vendas/pdv` faz criação + confirmação de uma vez.

**Cancelamento:** venda faturada exige cancelar a NF-e antes (até 24h). Cancelar a venda devolve os itens ao estoque e estorna os títulos.

**Compra:** `POST /api/compras` → `POST /api/compras/{id}/receber` dá entrada no estoque (recalcula custo médio) e cria as contas a pagar.

## Regras implementadas

- Estoque nunca negativo (configurável: `ESTOQUE_PERMITIR_NEGATIVO=true`), com controle de concorrência otimista no produto.
- Custo médio ponderado nas entradas; custo gravado no item da venda para cálculo de margem.
- Desconto geral e frete rateados por item na NF-e; Simples Nacional (CSOSN) e Regime Normal (ICMS/IPI/PIS/COFINS).
- Numeração da NF-e com lock pessimista (sem números duplicados sob concorrência).
- Limite de crédito do cliente em vendas a prazo.
- Erros no padrão RFC 7807 (`ProblemDetail`): 400 validação, 401, 403, 404, 409 conflito, 422 regra de negócio.

## NF-e: o que falta para produção

A emissão usa uma **SEFAZ simulada** (`app.nfe.sefaz=simulado`), que valida a chave e o NCM e autoriza localmente.
Para emitir de verdade, implemente `SefazClient` com:

1. Certificado digital A1 (.pfx) da empresa;
2. Assinatura XMLDSig do `infNFe`;
3. Envio ao web service `NFeAutorizacao4` da UF (homologação primeiro) e montagem do `nfeProc`;
4. Inutilização de numeração rejeitada, CC-e, DANFE (PDF) e contingência.

Caminhos comuns: biblioteca **Java_NFe** (Samuel Oliveira) ou APIs como Focus NFe, NFE.io e PlugNotas.
O cálculo de tributos é simplificado: não cobre ICMS-ST, DIFAL, FCP, benefícios fiscais nem os grupos de **IBS/CBS
da Reforma Tributária** — valide as regras com o contador da empresa antes de usar em produção.

## Configuração (variáveis de ambiente)

| Variável | Padrão |
|---|---|
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | `jdbc:postgresql://localhost:5432/erp`, `erp`, `erp` |
| `JWT_SECRET` | valor de desenvolvimento — **troque em produção** (mín. 32 caracteres) |
| `JWT_EXPIRACAO_MINUTOS` | `480` |
| `ADMIN_EMAIL`, `ADMIN_SENHA` | `admin@erp.com`, `admin123` |
| `SEED_DEMO` | `true` (cria produtos, clientes e fornecedor de exemplo) |
| `CORS_ORIGINS` | `*` |
| `DDL_AUTO` | `update` (para produção, migre para Flyway e use `validate`) |

## Estrutura

```
src/main/java/br/com/erp/
  common/      entidade base, exceções, validação CPF/CNPJ, parcelamento
  config/      segurança, OpenAPI, carga inicial
  seguranca/   JWT e login
  usuario/ empresa/ produto/ estoque/ cliente/ fornecedor/
  compra/ venda/ fiscal/ financeiro/ relatorio/
```

Cada módulo segue `Entidade → Repository → Service (regras + transação) → Controller`, com DTOs em records.
