package br.com.erp.fiscal.sefaz;

import br.com.erp.fiscal.NotaFiscal;

/**
 * Comunicação com a SEFAZ. A implementação real precisa:
 * 1) assinar o XML (XMLDSig) com o certificado digital A1 da empresa;
 * 2) enviar ao web service NFeAutorizacao4 da UF (SOAP 1.2, TLS mútuo);
 * 3) consultar o recibo / tratar o retorno síncrono e montar o nfeProc.
 * Bibliotecas prontas: "Java_NFe" (Samuel Oliveira) ou serviços como Focus NFe, NFE.io, PlugNotas.
 */
public interface SefazClient {

    RetornoSefaz autorizar(NotaFiscal nota);

    RetornoSefaz cancelar(NotaFiscal nota, String justificativa);

    record RetornoSefaz(boolean sucesso, String codigoStatus, String motivo, String protocolo) {
    }
}
