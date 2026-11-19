package br.com.erp.fiscal;

import br.com.erp.cliente.Cliente;
import br.com.erp.common.Endereco;
import br.com.erp.common.TipoPessoa;
import br.com.erp.empresa.Empresa;
import br.com.erp.financeiro.FormaPagamento;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Monta o XML da NF-e no layout 4.00 (grupos principais). O XML não é assinado:
 * a assinatura digital (certificado A1) e a transmissão ficam a cargo da implementação real de SefazClient.
 */
@Component
public class NfeXmlBuilder {

    private static final ZoneId FUSO = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter DATA_HORA = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX");
    private static final String HOMOLOGACAO_NOME = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL";

    public String gerar(NotaFiscal nf, Empresa emp, Cliente dest, FormaPagamento forma) {
        String chave = nf.getChaveAcesso();
        StringBuilder x = new StringBuilder(8192);
        x.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        x.append("<NFe xmlns=\"http://www.portalfiscal.inf.br/nfe\">");
        x.append("<infNFe versao=\"4.00\" Id=\"NFe").append(chave).append("\">");

        // ---- ide ----
        x.append("<ide>");
        tag(x, "cUF", emp.getCodigoUf());
        tag(x, "cNF", chave.substring(35, 43));
        tag(x, "natOp", nf.getNaturezaOperacao());
        tag(x, "mod", nf.getModelo());
        tag(x, "serie", nf.getSerie());
        tag(x, "nNF", nf.getNumero());
        tag(x, "dhEmi", nf.getDataEmissao().atZone(FUSO).format(DATA_HORA));
        tag(x, "tpNF", 1);
        String ufDest = dest == null || dest.getEndereco() == null ? null : dest.getEndereco().getUf();
        tag(x, "idDest", ufDest == null || ufDest.equalsIgnoreCase(emp.getEndereco().getUf()) ? 1 : 2);
        tag(x, "cMunFG", emp.getEndereco().getCodigoMunicipio());
        tag(x, "tpImp", 1);
        tag(x, "tpEmis", 1);
        tag(x, "cDV", chave.substring(43));
        tag(x, "tpAmb", nf.getAmbiente());
        tag(x, "finNFe", 1);
        boolean consumidorFinal = dest == null || dest.getTipoPessoa() == TipoPessoa.FISICA
                || dest.getInscricaoEstadual() == null || dest.getInscricaoEstadual().isBlank();
        tag(x, "indFinal", consumidorFinal ? 1 : 0);
        tag(x, "indPres", 1);
        tag(x, "procEmi", 0);
        tag(x, "verProc", "ERP-1.0");
        x.append("</ide>");

        // ---- emit ----
        x.append("<emit>");
        tag(x, "CNPJ", emp.getCnpj());
        tag(x, "xNome", emp.getRazaoSocial());
        tag(x, "xFant", emp.getNomeFantasia());
        endereco(x, "enderEmit", emp.getEndereco(), emp.getTelefone());
        tag(x, "IE", emp.getInscricaoEstadual());
        tag(x, "CRT", emp.getCrt());
        x.append("</emit>");

        // ---- dest ----
        if (dest != null) {
            x.append("<dest>");
            tag(x, dest.getTipoPessoa() == TipoPessoa.FISICA ? "CPF" : "CNPJ", dest.getDocumento());
            tag(x, "xNome", nf.getAmbiente() == 2 ? HOMOLOGACAO_NOME : dest.getNome());
            endereco(x, "enderDest", dest.getEndereco(), dest.getTelefone());
            boolean contribuinte = dest.getInscricaoEstadual() != null && !dest.getInscricaoEstadual().isBlank();
            tag(x, "indIEDest", contribuinte ? 1 : 9);
            if (contribuinte) {
                tag(x, "IE", dest.getInscricaoEstadual());
            }
            tag(x, "email", dest.getEmail());
            x.append("</dest>");
        }

        // ---- det ----
        boolean simples = emp.simplesNacional();
        for (ItemNotaFiscal it : nf.getItens()) {
            x.append("<det nItem=\"").append(it.getNumeroItem()).append("\">");
            x.append("<prod>");
            tag(x, "cProd", it.getCodigo());
            tag(x, "cEAN", it.getEan() == null ? "SEM GTIN" : it.getEan());
            tag(x, "xProd", nf.getAmbiente() == 2 && it.getNumeroItem() == 1 ? HOMOLOGACAO_NOME : it.getDescricao());
            tag(x, "NCM", it.getNcm() == null ? "00000000" : it.getNcm());
            tag(x, "CEST", it.getCest());
            tag(x, "CFOP", it.getCfop());
            tag(x, "uCom", it.getUnidade());
            tag(x, "qCom", dec(it.getQuantidade(), 4));
            tag(x, "vUnCom", dec(it.getValorUnitario(), 4));
            tag(x, "vProd", dec(it.getValorBruto(), 2));
            tag(x, "cEANTrib", it.getEan() == null ? "SEM GTIN" : it.getEan());
            tag(x, "uTrib", it.getUnidade());
            tag(x, "qTrib", dec(it.getQuantidade(), 4));
            tag(x, "vUnTrib", dec(it.getValorUnitario(), 4));
            if (it.getValorFrete().signum() > 0) {
                tag(x, "vFrete", dec(it.getValorFrete(), 2));
            }
            if (it.getValorDesconto().signum() > 0) {
                tag(x, "vDesc", dec(it.getValorDesconto(), 2));
            }
            tag(x, "indTot", 1);
            x.append("</prod>");

            x.append("<imposto>");
            // ICMS
            x.append("<ICMS>");
            if (simples) {
                String csosn = it.getCstIcms();
                String grupo = switch (csosn) {
                    case "101" -> "ICMSSN101";
                    case "201", "202", "203" -> "ICMSSN202";
                    case "500" -> "ICMSSN500";
                    case "900" -> "ICMSSN900";
                    default -> "ICMSSN102";
                };
                x.append('<').append(grupo).append('>');
                tag(x, "orig", it.getOrigem());
                tag(x, "CSOSN", csosn);
                x.append("</").append(grupo).append('>');
            } else if ("00".equals(it.getCstIcms())) {
                x.append("<ICMS00>");
                tag(x, "orig", it.getOrigem());
                tag(x, "CST", "00");
                tag(x, "modBC", 3);
                tag(x, "vBC", dec(it.getBaseIcms(), 2));
                tag(x, "pICMS", dec(it.getAliquotaIcms(), 4));
                tag(x, "vICMS", dec(it.getValorIcms(), 2));
                x.append("</ICMS00>");
            } else {
                x.append("<ICMS40>");
                tag(x, "orig", it.getOrigem());
                tag(x, "CST", it.getCstIcms());
                x.append("</ICMS40>");
            }
            x.append("</ICMS>");

            // IPI
            if (it.getValorIpi().signum() > 0) {
                x.append("<IPI><cEnq>999</cEnq><IPITrib>");
                tag(x, "CST", "50");
                tag(x, "vBC", dec(it.getValorBruto(), 2));
                tag(x, "pIPI", dec(it.getAliquotaIpi(), 4));
                tag(x, "vIPI", dec(it.getValorIpi(), 2));
                x.append("</IPITrib></IPI>");
            }

            // PIS / COFINS
            if (simples) {
                x.append("<PIS><PISOutr><CST>49</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>");
                x.append("<COFINS><COFINSOutr><CST>49</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS>"
                        + "<vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>");
            } else {
                x.append("<PIS><PISAliq>");
                tag(x, "CST", "01");
                tag(x, "vBC", dec(it.getBasePisCofins(), 2));
                tag(x, "pPIS", dec(it.getAliquotaPis(), 4));
                tag(x, "vPIS", dec(it.getValorPis(), 2));
                x.append("</PISAliq></PIS>");
                x.append("<COFINS><COFINSAliq>");
                tag(x, "CST", "01");
                tag(x, "vBC", dec(it.getBasePisCofins(), 2));
                tag(x, "pCOFINS", dec(it.getAliquotaCofins(), 4));
                tag(x, "vCOFINS", dec(it.getValorCofins(), 2));
                x.append("</COFINSAliq></COFINS>");
            }
            x.append("</imposto>");
            x.append("</det>");
        }

        // ---- total ----
        x.append("<total><ICMSTot>");
        tag(x, "vBC", dec(nf.getBaseIcms(), 2));
        tag(x, "vICMS", dec(nf.getValorIcms(), 2));
        for (String zero : new String[]{"vICMSDeson", "vFCP", "vBCST", "vST", "vFCPST", "vFCPSTRet"}) {
            tag(x, zero, "0.00");
        }
        tag(x, "vProd", dec(nf.getValorProdutos(), 2));
        tag(x, "vFrete", dec(nf.getValorFrete(), 2));
        tag(x, "vSeg", "0.00");
        tag(x, "vDesc", dec(nf.getValorDesconto(), 2));
        tag(x, "vII", "0.00");
        tag(x, "vIPI", dec(nf.getValorIpi(), 2));
        tag(x, "vIPIDevol", "0.00");
        tag(x, "vPIS", dec(nf.getValorPis(), 2));
        tag(x, "vCOFINS", dec(nf.getValorCofins(), 2));
        tag(x, "vOutro", "0.00");
        tag(x, "vNF", dec(nf.getValorTotal(), 2));
        x.append("</ICMSTot></total>");

        // ---- transp ----
        x.append("<transp>");
        tag(x, "modFrete", nf.getValorFrete().signum() > 0 ? 0 : 9);
        x.append("</transp>");

        // ---- pag ----
        x.append("<pag><detPag>");
        tag(x, "tPag", forma.getCodigoNfe());
        tag(x, "vPag", dec(nf.getValorTotal(), 2));
        x.append("</detPag></pag>");

        if (nf.getInformacoesComplementares() != null && !nf.getInformacoesComplementares().isBlank()) {
            x.append("<infAdic>");
            tag(x, "infCpl", nf.getInformacoesComplementares());
            x.append("</infAdic>");
        }

        x.append("</infNFe></NFe>");
        return x.toString();
    }

    private void endereco(StringBuilder x, String grupo, Endereco e, String fone) {
        if (e == null) {
            return;
        }
        x.append('<').append(grupo).append('>');
        tag(x, "xLgr", e.getLogradouro());
        tag(x, "nro", e.getNumero() == null ? "S/N" : e.getNumero());
        tag(x, "xCpl", e.getComplemento());
        tag(x, "xBairro", e.getBairro());
        tag(x, "cMun", e.getCodigoMunicipio());
        tag(x, "xMun", e.getMunicipio());
        tag(x, "UF", e.getUf());
        tag(x, "CEP", e.getCep());
        tag(x, "cPais", "1058");
        tag(x, "xPais", "BRASIL");
        tag(x, "fone", fone == null ? null : fone.replaceAll("\\D", ""));
        x.append("</").append(grupo).append('>');
    }

    /** Escreve a tag somente quando há valor (campos opcionais vazios não podem ir no XML). */
    private void tag(StringBuilder x, String nome, Object valor) {
        if (valor == null) {
            return;
        }
        String texto = valor.toString().trim();
        if (texto.isEmpty()) {
            return;
        }
        x.append('<').append(nome).append('>').append(escapar(texto)).append("</").append(nome).append('>');
    }

    private String dec(BigDecimal valor, int casas) {
        return (valor == null ? BigDecimal.ZERO : valor).setScale(casas, RoundingMode.HALF_EVEN).toPlainString();
    }

    private String escapar(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
