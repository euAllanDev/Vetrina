package br.com.erp.fiscal;

import br.com.erp.common.Valores;
import br.com.erp.empresa.Empresa;
import br.com.erp.produto.Produto;
import br.com.erp.venda.ItemVenda;
import br.com.erp.venda.Venda;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Cálculo simplificado de tributos por item:
 * - Rateia o desconto geral e o frete da venda proporcionalmente ao valor de cada item.
 * - Simples Nacional (CRT 1/2): ICMS pelo CSOSN (sem destaque), PIS/COFINS CST 49 zerados.
 * - Regime Normal (CRT 3): ICMS, IPI, PIS e COFINS pelas alíquotas do cadastro do produto.
 * Não cobre ST, DIFAL, FCP, benefícios fiscais nem IBS/CBS (Reforma Tributária) — ver README.
 */
@Component
public class CalculadoraImpostos {

    public List<ItemNotaFiscal> calcular(Venda venda, Empresa empresa) {
        List<ItemVenda> itensVenda = venda.getItens();
        BigDecimal baseRateio = itensVenda.stream().map(ItemVenda::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal[] rateioDesconto = ratear(venda.getValorDesconto(), itensVenda, baseRateio);
        BigDecimal[] rateioFrete = ratear(venda.getValorFrete(), itensVenda, baseRateio);
        boolean simples = empresa.simplesNacional();

        List<ItemNotaFiscal> itens = new ArrayList<>();
        for (int i = 0; i < itensVenda.size(); i++) {
            ItemVenda iv = itensVenda.get(i);
            Produto p = iv.getProduto();
            ItemNotaFiscal it = new ItemNotaFiscal();
            it.setNumeroItem(i + 1);
            it.setProduto(p);
            it.setCodigo(p.getCodigo());
            it.setDescricao(p.getDescricao());
            it.setEan(p.getEan());
            it.setNcm(p.getNcm());
            it.setCest(p.getCest());
            it.setCfop(p.getCfop());
            it.setUnidade(p.getUnidade());
            it.setQuantidade(iv.getQuantidade());
            it.setValorUnitario(iv.getPrecoUnitario());
            it.setValorBruto(Valores.moeda(iv.valorBruto()));
            it.setValorDesconto(iv.getValorDesconto().add(rateioDesconto[i]));
            it.setValorFrete(rateioFrete[i]);
            it.setOrigem(p.getOrigem());

            BigDecimal base = it.valorLiquido();
            if (simples) {
                it.setCstIcms(p.getCstIcms().length() == 3 ? p.getCstIcms() : "102");
                zerarIcms(it);
                it.setAliquotaIpi(BigDecimal.ZERO);
                it.setValorIpi(BigDecimal.ZERO);
                it.setBasePisCofins(BigDecimal.ZERO);
                it.setAliquotaPis(BigDecimal.ZERO);
                it.setValorPis(BigDecimal.ZERO);
                it.setAliquotaCofins(BigDecimal.ZERO);
                it.setValorCofins(BigDecimal.ZERO);
            } else {
                it.setCstIcms(p.getCstIcms().length() == 2 ? p.getCstIcms() : "00");
                if (Valores.positivo(p.getAliquotaIcms()) && "00".equals(it.getCstIcms())) {
                    it.setBaseIcms(base);
                    it.setAliquotaIcms(p.getAliquotaIcms());
                    it.setValorIcms(Valores.percentual(base, p.getAliquotaIcms()));
                } else {
                    zerarIcms(it);
                }
                it.setAliquotaIpi(p.getAliquotaIpi());
                it.setValorIpi(Valores.percentual(it.getValorBruto(), p.getAliquotaIpi()));
                it.setBasePisCofins(base);
                it.setAliquotaPis(p.getAliquotaPis());
                it.setValorPis(Valores.percentual(base, p.getAliquotaPis()));
                it.setAliquotaCofins(p.getAliquotaCofins());
                it.setValorCofins(Valores.percentual(base, p.getAliquotaCofins()));
            }
            itens.add(it);
        }
        return itens;
    }

    private void zerarIcms(ItemNotaFiscal it) {
        it.setBaseIcms(BigDecimal.ZERO);
        it.setAliquotaIcms(BigDecimal.ZERO);
        it.setValorIcms(BigDecimal.ZERO);
    }

    /** Rateio proporcional; a sobra de arredondamento vai para o último item. */
    private BigDecimal[] ratear(BigDecimal valor, List<ItemVenda> itens, BigDecimal base) {
        BigDecimal[] partes = new BigDecimal[itens.size()];
        BigDecimal total = Valores.moeda(valor);
        BigDecimal acumulado = BigDecimal.ZERO;
        for (int i = 0; i < itens.size(); i++) {
            if (total.signum() == 0 || base.signum() == 0) {
                partes[i] = BigDecimal.ZERO.setScale(2);
                continue;
            }
            if (i == itens.size() - 1) {
                partes[i] = total.subtract(acumulado);
            } else {
                partes[i] = total.multiply(itens.get(i).getSubtotal()).divide(base, 2, RoundingMode.HALF_EVEN);
                acumulado = acumulado.add(partes[i]);
            }
        }
        return partes;
    }
}
