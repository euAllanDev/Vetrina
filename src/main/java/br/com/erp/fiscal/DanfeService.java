package br.com.erp.fiscal;

import br.com.erp.cliente.Cliente;
import br.com.erp.common.Endereco;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.common.TipoPessoa;
import br.com.erp.empresa.Empresa;
import br.com.erp.empresa.EmpresaService;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Gera o DANFE (Documento Auxiliar da NF-e) em PDF, formato retrato A4, seguindo os blocos do
 * Manual de Orientação do Contribuinte: canhoto, identificação do emitente, código de barras da chave,
 * destinatário, cálculo do imposto, transportador, produtos e dados adicionais.
 */
@Service
@RequiredArgsConstructor
public class DanfeService {

    private static final Locale BR = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm:ss");
    private static final DateTimeFormatter DATA_HORA = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    private static final Font F_LABEL = new Font(Font.HELVETICA, 5.5f, Font.NORMAL);
    private static final Font F_VALOR = new Font(Font.HELVETICA, 8f, Font.NORMAL);
    private static final Font F_VALOR_B = new Font(Font.HELVETICA, 8f, Font.BOLD);
    private static final Font F_TITULO = new Font(Font.HELVETICA, 6.5f, Font.BOLD);
    private static final Font F_ITEM = new Font(Font.HELVETICA, 6.5f, Font.NORMAL);
    private static final Font F_ITEM_H = new Font(Font.HELVETICA, 5.5f, Font.BOLD);
    private static final float BORDA = 0.5f;

    private final NotaFiscalRepository repository;
    private final EmpresaService empresaService;

    @Transactional(readOnly = true)
    public byte[] gerar(Long notaId) {
        NotaFiscal nf = repository.findById(notaId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Nota fiscal", notaId));
        Empresa emp = empresaService.obter();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            montar(nf, emp, out);
        } catch (DocumentException e) {
            throw new IllegalStateException("Falha ao gerar o DANFE da NF-e " + nf.getNumero(), e);
        }
        return out.toByteArray();
    }

    private void montar(NotaFiscal nf, Empresa emp, ByteArrayOutputStream out) throws DocumentException {
        Document doc = new Document(PageSize.A4, 18, 18, 16, 16);
        PdfWriter writer = PdfWriter.getInstance(doc, out);
        writer.setPageEvent(new MarcaDagua(nf));
        doc.addTitle("DANFE NF-e " + nf.getNumero());
        doc.addCreator("ERP");
        doc.open();

        doc.add(canhoto(nf, emp));
        doc.add(espaco(6));
        doc.add(cabecalho(nf, emp, writer));
        doc.add(naturezaProtocolo(nf));
        doc.add(inscricoes(emp));
        doc.add(titulo("DESTINATÁRIO / REMETENTE"));
        doc.add(destinatario(nf));
        doc.add(titulo("CÁLCULO DO IMPOSTO"));
        doc.add(impostos(nf));
        doc.add(titulo("TRANSPORTADOR / VOLUMES TRANSPORTADOS"));
        doc.add(transportador(nf));
        doc.add(titulo("DADOS DOS PRODUTOS / SERVIÇOS"));
        doc.add(produtos(nf));
        doc.add(titulo("DADOS ADICIONAIS"));
        doc.add(adicionais(nf, emp));

        doc.close();
    }

    // ------------------------------------------------------------------ blocos

    private PdfPTable canhoto(NotaFiscal nf, Empresa emp) {
        PdfPTable t = tabela(new float[]{4.2f, 1.6f, 4.2f, 1.6f});
        PdfPCell texto = campo(null, "RECEBEMOS DE " + emp.getRazaoSocial().toUpperCase(BR)
                + " OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO. EMISSÃO: "
                + nf.getDataEmissao().format(DATA) + "  VALOR TOTAL: R$ " + moeda(nf.getValorTotal())
                + "  DESTINATÁRIO: " + nomeDestinatario(nf), 3);
        texto.setMinimumHeight(20);
        t.addCell(texto);
        PdfPCell num = new PdfPCell(new Phrase("NF-e\nNº " + numero(nf.getNumero()) + "\nSÉRIE " + nf.getSerie(), F_VALOR_B));
        num.setRowspan(2);
        num.setHorizontalAlignment(Element.ALIGN_CENTER);
        num.setVerticalAlignment(Element.ALIGN_MIDDLE);
        num.setBorderWidth(BORDA);
        t.addCell(num);
        t.addCell(campo("DATA DE RECEBIMENTO", " ", 1, 20));
        t.addCell(campo("IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR", " ", 2, 20));
        return t;
    }

    private PdfPTable cabecalho(NotaFiscal nf, Empresa emp, PdfWriter writer) {
        PdfPTable t = tabela(new float[]{4.3f, 2.2f, 4.5f});

        Endereco e = emp.getEndereco();
        Phrase pe = new Phrase();
        pe.add(new Chunk("IDENTIFICAÇÃO DO EMITENTE\n", F_LABEL));
        pe.add(new Chunk(emp.getRazaoSocial().toUpperCase(BR) + "\n", new Font(Font.HELVETICA, 10, Font.BOLD)));
        pe.add(new Chunk(enderecoLinha(e) + "\n" + nvl(e == null ? null : e.getBairro()) + " - CEP " + cep(e == null ? null : e.getCep())
                + "\n" + nvl(e == null ? null : e.getMunicipio()) + " - " + nvl(e == null ? null : e.getUf())
                + (emp.getTelefone() != null ? "  Fone: " + emp.getTelefone() : ""), F_VALOR));
        PdfPCell emit = new PdfPCell(pe);
        emit.setBorderWidth(BORDA);
        emit.setPadding(5);
        emit.setRowspan(3);
        emit.setVerticalAlignment(Element.ALIGN_MIDDLE);
        t.addCell(emit);

        Phrase pd = new Phrase();
        pd.add(new Chunk("DANFE\n", new Font(Font.HELVETICA, 13, Font.BOLD)));
        pd.add(new Chunk("Documento Auxiliar da\nNota Fiscal Eletrônica\n\n", new Font(Font.HELVETICA, 6.5f)));
        pd.add(new Chunk("0 - ENTRADA\n1 - SAÍDA      [ 1 ]\n\n", new Font(Font.HELVETICA, 7)));
        pd.add(new Chunk("Nº " + numero(nf.getNumero()) + "\nSÉRIE " + nf.getSerie() + "\nFOLHA 1", F_VALOR_B));
        PdfPCell danfe = new PdfPCell(pd);
        danfe.setBorderWidth(BORDA);
        danfe.setRowspan(3);
        danfe.setHorizontalAlignment(Element.ALIGN_CENTER);
        danfe.setVerticalAlignment(Element.ALIGN_MIDDLE);
        danfe.setPadding(4);
        t.addCell(danfe);

        Barcode128 barras = new Barcode128();
        barras.setCode(nf.getChaveAcesso());
        barras.setFont(null);
        barras.setBarHeight(32f);
        barras.setX(0.72f);
        Image img = barras.createImageWithBarcode(writer.getDirectContent(), null, null);
        PdfPCell cb = new PdfPCell(img, true);
        cb.setBorderWidth(BORDA);
        cb.setPadding(5);
        cb.setFixedHeight(46);
        cb.setHorizontalAlignment(Element.ALIGN_CENTER);
        cb.setVerticalAlignment(Element.ALIGN_MIDDLE);
        t.addCell(cb);

        t.addCell(campo("CHAVE DE ACESSO", chave(nf.getChaveAcesso()), 1, 0, F_VALOR_B, Element.ALIGN_CENTER));

        PdfPCell consulta = new PdfPCell(new Phrase("Consulta de autenticidade no portal nacional da NF-e\nwww.nfe.fazenda.gov.br/portal "
                + "ou no site da Sefaz Autorizadora", new Font(Font.HELVETICA, 7)));
        consulta.setBorderWidth(BORDA);
        consulta.setHorizontalAlignment(Element.ALIGN_CENTER);
        consulta.setPadding(5);
        t.addCell(consulta);
        return t;
    }

    private PdfPTable naturezaProtocolo(NotaFiscal nf) {
        PdfPTable t = tabela(new float[]{6.5f, 4.5f});
        t.addCell(campo("NATUREZA DA OPERAÇÃO", nf.getNaturezaOperacao(), 1));
        String protocolo = switch (nf.getStatus()) {
            case AUTORIZADA, CANCELADA -> nvl(nf.getProtocolo()) + "  " + (nf.getDataAutorizacao() == null ? "" : nf.getDataAutorizacao().format(DATA_HORA));
            case REJEITADA -> "NÃO AUTORIZADA";
        };
        t.addCell(campo("PROTOCOLO DE AUTORIZAÇÃO DE USO", protocolo, 1, 0, F_VALOR, Element.ALIGN_CENTER));
        return t;
    }

    private PdfPTable inscricoes(Empresa emp) {
        PdfPTable t = tabela(new float[]{1, 1, 1});
        t.addCell(campo("INSCRIÇÃO ESTADUAL", emp.getInscricaoEstadual(), 1));
        t.addCell(campo("INSC. ESTADUAL DO SUBST. TRIBUT.", "", 1));
        t.addCell(campo("CNPJ", documento(emp.getCnpj()), 1));
        return t;
    }

    private PdfPTable destinatario(NotaFiscal nf) {
        Cliente c = nf.getCliente();
        Endereco e = c == null ? null : c.getEndereco();
        PdfPTable t = tabela(new float[]{5.6f, 2.6f, 1.6f, 1.6f});
        t.addCell(campo("NOME / RAZÃO SOCIAL", nomeDestinatario(nf), 1));
        t.addCell(campo(c != null && c.getTipoPessoa() == TipoPessoa.FISICA ? "CPF" : "CNPJ / CPF", c == null ? "" : documento(c.getDocumento()), 1));
        t.addCell(campo("DATA DA EMISSÃO", nf.getDataEmissao().format(DATA), 2));

        t.addCell(campo("ENDEREÇO", enderecoLinha(e), 1));
        t.addCell(campo("BAIRRO / DISTRITO", e == null ? "" : nvl(e.getBairro()), 1));
        t.addCell(campo("CEP", e == null ? "" : cep(e.getCep()), 1));
        t.addCell(campo("DATA DA SAÍDA", nf.getDataEmissao().format(DATA), 1));

        PdfPTable l3 = tabela(new float[]{4.2f, 2.4f, 0.8f, 2.4f, 1.6f});
        l3.addCell(campo("MUNICÍPIO", e == null ? "" : nvl(e.getMunicipio()), 1));
        l3.addCell(campo("FONE / FAX", c == null ? "" : nvl(c.getTelefone()), 1));
        l3.addCell(campo("UF", e == null ? "" : nvl(e.getUf()), 1));
        l3.addCell(campo("INSCRIÇÃO ESTADUAL", c == null ? "" : nvl(c.getInscricaoEstadual()), 1));
        l3.addCell(campo("HORA DA SAÍDA", nf.getDataEmissao().format(HORA), 1));
        PdfPCell wrap = new PdfPCell(l3);
        wrap.setColspan(4);
        wrap.setBorder(Rectangle.NO_BORDER);
        wrap.setPadding(0);
        t.addCell(wrap);
        return t;
    }

    private PdfPTable impostos(NotaFiscal nf) {
        PdfPTable t = tabela(new float[]{1, 1, 1, 1, 1, 1.2f});
        t.addCell(valor("BASE DE CÁLC. DO ICMS", nf.getBaseIcms()));
        t.addCell(valor("VALOR DO ICMS", nf.getValorIcms()));
        t.addCell(valor("BASE DE CÁLC. ICMS S.T.", BigDecimal.ZERO));
        t.addCell(valor("VALOR DO ICMS SUBST.", BigDecimal.ZERO));
        t.addCell(valor("V. TOTAL TRIB. (PIS+COFINS)", nf.getValorPis().add(nf.getValorCofins())));
        t.addCell(valor("V. TOTAL PRODUTOS", nf.getValorProdutos()));
        t.addCell(valor("VALOR DO FRETE", nf.getValorFrete()));
        t.addCell(valor("VALOR DO SEGURO", BigDecimal.ZERO));
        t.addCell(valor("DESCONTO", nf.getValorDesconto()));
        t.addCell(valor("OUTRAS DESPESAS", BigDecimal.ZERO));
        t.addCell(valor("VALOR TOTAL IPI", nf.getValorIpi()));
        PdfPCell total = campo("V. TOTAL DA NOTA", moeda(nf.getValorTotal()), 1, 0, F_VALOR_B, Element.ALIGN_RIGHT);
        t.addCell(total);
        return t;
    }

    private PdfPTable transportador(NotaFiscal nf) {
        PdfPTable t = tabela(new float[]{5, 2.6f, 3.4f});
        t.addCell(campo("NOME / RAZÃO SOCIAL", "", 1));
        boolean comFrete = nf.getValorFrete() != null && nf.getValorFrete().signum() > 0;
        t.addCell(campo("FRETE POR CONTA", comFrete ? "0 - Emitente" : "9 - Sem frete", 1));
        t.addCell(campo("CNPJ / CPF", "", 1));
        return t;
    }

    private PdfPTable produtos(NotaFiscal nf) {
        String[] cab = {"CÓDIGO", "DESCRIÇÃO DO PRODUTO / SERVIÇO", "NCM/SH", "CST/ CSOSN", "CFOP", "UN", "QUANT.",
                "VALOR UNIT.", "VALOR TOTAL", "B. CÁLC. ICMS", "VALOR ICMS", "VALOR IPI", "ALÍQ. ICMS", "ALÍQ. IPI"};
        float[] larguras = {1.3f, 4.2f, 1.1f, 0.7f, 0.7f, 0.5f, 0.9f, 1.0f, 1.1f, 1.0f, 0.9f, 0.8f, 0.6f, 0.6f};
        PdfPTable t = tabela(larguras);
        t.setHeaderRows(1);
        for (String h : cab) {
            PdfPCell c = new PdfPCell(new Phrase(h, F_ITEM_H));
            c.setBorderWidth(BORDA);
            c.setHorizontalAlignment(Element.ALIGN_CENTER);
            c.setVerticalAlignment(Element.ALIGN_MIDDLE);
            c.setPadding(2);
            t.addCell(c);
        }
        for (ItemNotaFiscal i : nf.getItens()) {
            item(t, i.getCodigo(), Element.ALIGN_LEFT);
            item(t, i.getDescricao(), Element.ALIGN_LEFT);
            item(t, nvl(i.getNcm()), Element.ALIGN_CENTER);
            item(t, i.getOrigem() + i.getCstIcms(), Element.ALIGN_CENTER);
            item(t, i.getCfop(), Element.ALIGN_CENTER);
            item(t, i.getUnidade(), Element.ALIGN_CENTER);
            item(t, quantidade(i.getQuantidade()), Element.ALIGN_RIGHT);
            item(t, moeda(i.getValorUnitario()), Element.ALIGN_RIGHT);
            item(t, moeda(i.getValorBruto()), Element.ALIGN_RIGHT);
            item(t, moeda(i.getBaseIcms()), Element.ALIGN_RIGHT);
            item(t, moeda(i.getValorIcms()), Element.ALIGN_RIGHT);
            item(t, moeda(i.getValorIpi()), Element.ALIGN_RIGHT);
            item(t, moeda(i.getAliquotaIcms()), Element.ALIGN_RIGHT);
            item(t, moeda(i.getAliquotaIpi()), Element.ALIGN_RIGHT);
        }
        return t;
    }

    private PdfPTable adicionais(NotaFiscal nf, Empresa emp) {
        StringBuilder info = new StringBuilder();
        if (nf.getAmbiente() == 2) {
            info.append("NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL. ");
        }
        if (emp.simplesNacional()) {
            info.append("DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI. ");
        }
        if (nf.getInformacoesComplementares() != null) {
            info.append(nf.getInformacoesComplementares()).append(' ');
        }
        info.append("Venda nº ").append(nf.getVenda().getId()).append('.');
        if (nf.getStatus() == StatusNotaFiscal.CANCELADA) {
            info.append(" NF-E CANCELADA EM ").append(nf.getDataCancelamento().format(DATA_HORA))
                    .append(". PROTOCOLO ").append(nvl(nf.getProtocoloCancelamento())).append('.');
        }
        PdfPTable t = tabela(new float[]{7, 4});
        t.addCell(campo("INFORMAÇÕES COMPLEMENTARES", info.toString(), 1, 70));
        t.addCell(campo("RESERVADO AO FISCO", "", 1, 70));
        return t;
    }

    // ------------------------------------------------------------------ auxiliares

    private static PdfPTable tabela(float[] larguras) {
        PdfPTable t = new PdfPTable(larguras);
        t.setWidthPercentage(100);
        t.setSplitLate(false);
        return t;
    }

    private static Paragraph titulo(String texto) {
        Paragraph p = new Paragraph(texto, F_TITULO);
        p.setSpacingBefore(5);
        p.setSpacingAfter(1);
        return p;
    }

    private static Paragraph espaco(float altura) {
        Paragraph p = new Paragraph(" ", new Font(Font.HELVETICA, 2));
        p.setSpacingAfter(altura);
        return p;
    }

    private static PdfPCell campo(String rotulo, String valor, int colspan) {
        return campo(rotulo, valor, colspan, 0, F_VALOR, Element.ALIGN_LEFT);
    }

    private static PdfPCell campo(String rotulo, String valor, int colspan, float alturaMinima) {
        return campo(rotulo, valor, colspan, alturaMinima, F_VALOR, Element.ALIGN_LEFT);
    }

    private static PdfPCell campo(String rotulo, String valor, int colspan, float alturaMinima, Font fonte, int alinhamento) {
        Phrase p = new Phrase();
        if (rotulo != null) {
            p.add(new Chunk(rotulo + "\n", F_LABEL));
        }
        p.add(new Chunk(valor == null || valor.isEmpty() ? " " : valor, rotulo == null ? new Font(Font.HELVETICA, 7) : fonte));
        PdfPCell c = new PdfPCell(p);
        c.setColspan(colspan);
        c.setBorderWidth(BORDA);
        c.setPaddingLeft(3);
        c.setPaddingRight(3);
        c.setPaddingTop(1.5f);
        c.setPaddingBottom(3);
        c.setHorizontalAlignment(alinhamento);
        if (alturaMinima > 0) {
            c.setMinimumHeight(alturaMinima);
        }
        return c;
    }

    private static PdfPCell valor(String rotulo, BigDecimal v) {
        return campo(rotulo, moeda(v), 1, 0, F_VALOR, Element.ALIGN_RIGHT);
    }

    private static void item(PdfPTable t, String texto, int alinhamento) {
        PdfPCell c = new PdfPCell(new Phrase(texto == null ? "" : texto, F_ITEM));
        c.setBorderWidth(BORDA);
        c.setBorderWidthTop(0);
        c.setBorderWidthBottom(0.25f);
        c.setBorderColorBottom(new Color(200, 200, 200));
        c.setHorizontalAlignment(alinhamento);
        c.setPadding(2.5f);
        t.addCell(c);
    }

    private static String nomeDestinatario(NotaFiscal nf) {
        if (nf.getAmbiente() == 2) {
            return "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL";
        }
        return nf.getCliente() == null ? "CONSUMIDOR FINAL" : nf.getCliente().getNome().toUpperCase(BR);
    }

    private static String enderecoLinha(Endereco e) {
        if (e == null || e.getLogradouro() == null) {
            return "";
        }
        return e.getLogradouro() + ", " + (e.getNumero() == null ? "S/N" : e.getNumero())
                + (e.getComplemento() == null ? "" : " - " + e.getComplemento());
    }

    private static String moeda(BigDecimal v) {
        DecimalFormat f = new DecimalFormat("#,##0.00", DecimalFormatSymbols.getInstance(BR));
        return f.format(v == null ? BigDecimal.ZERO : v);
    }

    private static String quantidade(BigDecimal v) {
        DecimalFormat f = new DecimalFormat("#,##0.####", DecimalFormatSymbols.getInstance(BR));
        return f.format(v == null ? BigDecimal.ZERO : v);
    }

    private static String numero(Integer n) {
        String s = String.format("%09d", n);
        return s.substring(0, 3) + "." + s.substring(3, 6) + "." + s.substring(6);
    }

    private static String chave(String c) {
        return c.replaceAll("(.{4})", "$1 ").trim();
    }

    private static String documento(String d) {
        if (d == null) {
            return "";
        }
        if (d.length() == 11) {
            return d.replaceAll("(.{3})(.{3})(.{3})(.{2})", "$1.$2.$3-$4");
        }
        if (d.length() == 14) {
            return d.replaceAll("(.{2})(.{3})(.{3})(.{4})(.{2})", "$1.$2.$3/$4-$5");
        }
        return d;
    }

    private static String cep(String c) {
        return c != null && c.length() == 8 ? c.substring(0, 5) + "-" + c.substring(5) : nvl(c);
    }

    private static String nvl(String s) {
        return s == null ? "" : s;
    }

    /** Marca d'água diagonal: homologação ("SEM VALOR FISCAL") e/ou nota cancelada. */
    private static final class MarcaDagua extends PdfPageEventHelper {
        private final NotaFiscal nf;

        MarcaDagua(NotaFiscal nf) {
            this.nf = nf;
        }

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            PdfContentByte cb = writer.getDirectContentUnder();
            float x = document.getPageSize().getWidth() / 2;
            float y = document.getPageSize().getHeight() / 2;
            if (nf.getStatus() == StatusNotaFiscal.CANCELADA) {
                Font f = new Font(Font.HELVETICA, 80, Font.BOLD, new Color(240, 170, 170));
                ColumnText.showTextAligned(cb, Element.ALIGN_CENTER, new Phrase("CANCELADA", f), x, y, 45);
            } else if (nf.getAmbiente() == 2) {
                Font f = new Font(Font.HELVETICA, 56, Font.BOLD, new Color(225, 225, 225));
                ColumnText.showTextAligned(cb, Element.ALIGN_CENTER, new Phrase("SEM VALOR FISCAL", f), x, y, 45);
            }
        }
    }

    /** Usado para o nome do arquivo baixado. */
    public String nomeArquivo(Long notaId) {
        return repository.findById(notaId).map(n -> "DANFE-" + n.getChaveAcesso() + ".pdf").orElse("DANFE.pdf");
    }
}
