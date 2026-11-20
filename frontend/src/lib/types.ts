export type Role = 'ADMIN' | 'GERENTE' | 'VENDEDOR' | 'ESTOQUISTA' | 'FINANCEIRO';
export type TipoPessoa = 'FISICA' | 'JURIDICA';
export type FormaPagamento =
  | 'DINHEIRO' | 'PIX' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO' | 'BOLETO' | 'CREDIARIO' | 'CHEQUE' | 'TRANSFERENCIA';
export type StatusVenda = 'ORCAMENTO' | 'CONFIRMADA' | 'FATURADA' | 'CANCELADA';
export type StatusTitulo = 'ABERTO' | 'PAGO' | 'CANCELADO';
export type StatusNota = 'AUTORIZADA' | 'REJEITADA' | 'CANCELADA';
export type StatusCompra = 'ABERTO' | 'RECEBIDO' | 'CANCELADO';

export interface Page<T> {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
}

export interface Usuario { id: number; nome: string; email: string; role: Role; ativo: boolean; criadoEm: string }

export interface Endereco {
  logradouro?: string | null; numero?: string | null; complemento?: string | null; bairro?: string | null;
  municipio?: string | null; codigoMunicipio?: string | null; uf?: string | null; cep?: string | null;
}

export interface Empresa {
  id: number; razaoSocial: string; nomeFantasia: string | null; cnpj: string; inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null; crt: number; telefone: string | null; email: string | null; endereco: Endereco;
  codigoUf: number; serieNfe: number; proximoNumeroNfe: number; ambienteNfe: number;
}

export interface Categoria { id: number; nome: string; descricao: string | null; ativo: boolean }

export interface Produto {
  id: number; codigo: string; descricao: string; ean: string | null; categoriaId: number | null; categoriaNome: string | null;
  unidade: string; precoCusto: number; precoVenda: number; estoqueAtual: number; estoqueMinimo: number;
  abaixoDoMinimo: boolean; ativo: boolean; ncm: string | null; cest: string | null; cfop: string; origem: number;
  cstIcms: string; aliquotaIcms: number; aliquotaIpi: number; aliquotaPis: number; aliquotaCofins: number;
  imagemUrl: string | null;
  precoAnterior: number | null;
  detalhes: string | null;
  criadoEm: string;
}

export interface Cliente {
  id: number; tipoPessoa: TipoPessoa; nome: string; documento: string; inscricaoEstadual: string | null;
  email: string | null; telefone: string | null; endereco: Endereco | null; limiteCredito: number; ativo: boolean;
}

export interface Fornecedor {
  id: number; tipoPessoa: TipoPessoa; razaoSocial: string; nomeFantasia: string | null; documento: string;
  inscricaoEstadual: string | null; email: string | null; telefone: string | null; contato: string | null;
  endereco: Endereco | null; ativo: boolean;
}

export interface ItemVenda {
  id: number; produtoId: number; produtoCodigo: string; produtoDescricao: string; unidade: string;
  quantidade: number; precoUnitario: number; valorDesconto: number; subtotal: number;
}

export interface Venda {
  id: number; clienteId: number | null; clienteNome: string; vendedor: string; status: StatusVenda;
  formaPagamento: FormaPagamento; quantidadeParcelas: number; subtotal: number; valorDesconto: number;
  valorFrete: number; valorTotal: number; criadoEm: string; dataConfirmacao: string | null;
  dataCancelamento: string | null; motivoCancelamento: string | null; observacao: string | null; itens: ItemVenda[];
}

export interface ItemNota {
  numeroItem: number; codigo: string; descricao: string; ncm: string | null; cfop: string; unidade: string;
  quantidade: number; valorUnitario: number; valorBruto: number; valorDesconto: number; valorFrete: number;
  cstIcms: string; baseIcms: number; aliquotaIcms: number; valorIcms: number; valorIpi: number; valorPis: number; valorCofins: number;
}

export interface NotaFiscal {
  id: number; vendaId: number; clienteId: number | null; clienteNome: string; modelo: string; serie: number;
  numero: number; chaveAcesso: string; status: StatusNota; ambiente: number; naturezaOperacao: string;
  dataEmissao: string; dataAutorizacao: string | null; protocolo: string | null; motivoStatus: string | null;
  dataCancelamento: string | null; justificativaCancelamento: string | null; valorProdutos: number;
  valorDesconto: number; valorFrete: number; baseIcms: number; valorIcms: number; valorIpi: number;
  valorPis: number; valorCofins: number; valorTotal: number; itens: ItemNota[];
}

export interface Movimentacao {
  id: number; produtoId: number; produtoCodigo: string; produtoDescricao: string; tipo: 'ENTRADA' | 'SAIDA';
  origem: string; referenciaId: number | null; quantidade: number; saldoAnterior: number; saldoPosterior: number;
  custoUnitario: number | null; observacao: string | null; usuario: string; data: string;
}

export interface ItemCompra { id: number; produtoId: number; produtoCodigo: string; produtoDescricao: string; quantidade: number; custoUnitario: number; subtotal: number }
export interface PedidoCompra {
  id: number; fornecedorId: number; fornecedorNome: string; status: StatusCompra; criadoEm: string;
  previsaoEntrega: string | null; dataRecebimento: string | null; numeroNotaFornecedor: string | null;
  quantidadeParcelas: number; valorFrete: number; valorTotal: number; observacao: string | null; usuario: string;
  itens: ItemCompra[];
}

export interface ContaReceber {
  id: number; clienteId: number | null; clienteNome: string | null; vendaId: number | null; descricao: string;
  numeroParcela: number; totalParcelas: number; valor: number; valorRecebido: number | null; vencimento: string;
  dataRecebimento: string | null; formaPagamento: FormaPagamento | null; status: StatusTitulo; vencida: boolean; observacao: string | null;
}
export interface ContaPagar {
  id: number; fornecedorId: number | null; fornecedorNome: string | null; compraId: number | null; descricao: string;
  categoria: string | null; numeroParcela: number; totalParcelas: number; valor: number; valorPago: number | null;
  vencimento: string; dataPagamento: string | null; formaPagamento: FormaPagamento | null; status: StatusTitulo;
  vencida: boolean; observacao: string | null;
}

export interface Periodo { quantidadeVendas: number; faturamento: number; ticketMedio: number }
export interface ProdutoVendido { produtoId: number; codigo: string; descricao: string; quantidade: number; faturamento: number; custo: number }
export interface Dashboard {
  hoje: Periodo; mesAtual: Periodo; produtosAbaixoDoMinimo: number; valorEstoqueCusto: number;
  receberVencido: number; receberProximos7Dias: number; pagarVencido: number; pagarProximos7Dias: number;
  topProdutosMes: ProdutoVendido[];
}
export interface RelatorioVendas { inicio: string; fim: string; totais: Periodo; porDia: { dia: string; quantidade: number; total: number }[] }
export interface CurvaAbcItem {
  produtoId: number; codigo: string; descricao: string; quantidade: number; faturamento: number; lucroBruto: number;
  percentual: number; percentualAcumulado: number; classe: 'A' | 'B' | 'C';
}
export interface FluxoCaixa { inicio: string; fim: string; recebido: number; pago: number; saldoRealizado: number; aReceber: number; aPagar: number; saldoPrevisto: number }
export interface ResumoEstoque { produtosAtivos: number; produtosAbaixoDoMinimo: number; valorTotalCusto: number }

/* ---------- afiliados ---------- */
export type RedeAfiliado = 'MERCADO_LIVRE' | 'ALIEXPRESS' | 'SHOPEE' | 'AWIN' | 'OUTRA';
export interface Parceiro { id: number; nome: string; rede: RedeAfiliado; cor: string | null; site: string | null; awinMerchantId: string | null; ativo: boolean; ofertas: number }
export interface OfertaAdmin {
  id: number; produtoId: number; parceiroId: number; parceiroNome: string; parceiroCor: string | null; rede: RedeAfiliado;
  url: string; urlProduto: string | null; preco: number; precoAnterior: number | null; frete: number | null; parcelamento: string | null;
  nota: number | null; avaliacoes: number | null; disponivel: boolean; ativo: boolean; verificadoEm: string | null; cliques: number;
  codigoExterno: string | null; atualizacaoAuto: boolean; sincronizadoEm: string | null; erroSincronizacao: string | null;
}
export interface StatusMercadoLivre {
  configurado: boolean; conectado: boolean; apelido: string | null; conectadoEm: string | null;
  ultimaSincronizacao: string | null; ultimoResumo: string | null; agendadorExterno: boolean;
}
export interface CapturaVerificacao {
  loja: string; parceiro: string; codigo: string | null;
  existente: { produtoId: number; ofertaId: number; nome: string; preco: number; categoriaId: number | null; temFoto: boolean; link: string | null } | null;
}
export interface CapturaResultado { produtoId: number; ofertaId: number; nome: string; novo: boolean; preco: number; precoAntes: number | null; baixou: boolean; temFoto: boolean }
export interface ImportacaoMl { produtoId: number; ofertaId: number; nome: string; preco: number; precoAnterior: number | null; foto: boolean }
export interface RelatorioCliques {
  dias: number; total: number;
  porDia: { dia: string; cliques: number }[];
  porParceiro: { parceiroId: number; nome: string; cor: string | null; cliques: number }[];
  topProdutos: { produtoId: number; nome: string; cliques: number }[];
}
