# Teste de fumaça do ERP: login -> venda PDV -> NF-e -> compra -> financeiro -> dashboard.
# Uso (PowerShell, com o docker compose rodando):  .\scripts\smoke-test.ps1
$ErrorActionPreference = "Stop"
$base = "http://localhost:8080"

function Passo($t) { Write-Host "`n== $t" -ForegroundColor Cyan }

Passo "Login"
$login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType "application/json" `
  -Body (@{ email = "admin@erp.com"; senha = "admin123" } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.accessToken)" }
Write-Host "OK - usuario: $($login.usuario.nome) ($($login.usuario.role))"

Passo "Produtos"
$produtos = (Invoke-RestMethod -Uri "$base/api/produtos?size=50" -Headers $h).content
$produtos | Format-Table id, codigo, descricao, precoVenda, estoqueAtual -AutoSize
$mouse = $produtos | Where-Object codigo -eq "MOU-001"
$teclado = $produtos | Where-Object codigo -eq "TEC-001"

Passo "Clientes"
$clientes = (Invoke-RestMethod -Uri "$base/api/clientes" -Headers $h).content
$maria = $clientes | Where-Object { $_.documento -eq "52998224725" }
Write-Host "Cliente: $($maria.nome) (id $($maria.id))"

Passo "Venda PDV (PIX, com desconto e frete)"
$venda = Invoke-RestMethod -Method Post -Uri "$base/api/vendas/pdv" -Headers $h -ContentType "application/json" -Body (@{
  clienteId = $maria.id; formaPagamento = "PIX"; valorDesconto = 5; valorFrete = 10
  itens = @(@{ produtoId = $mouse.id; quantidade = 2 }, @{ produtoId = $teclado.id; quantidade = 1; valorDesconto = 4.90 })
} | ConvertTo-Json -Depth 5)
Write-Host "Venda #$($venda.id) status=$($venda.status) total=$($venda.valorTotal)"

Passo "Venda a prazo (crediario 3x) e confirmacao"
$orc = Invoke-RestMethod -Method Post -Uri "$base/api/vendas" -Headers $h -ContentType "application/json" -Body (@{
  clienteId = $maria.id; formaPagamento = "CREDIARIO"; quantidadeParcelas = 3
  itens = @(@{ produtoId = $mouse.id; quantidade = 1 })
} | ConvertTo-Json -Depth 5)
$conf = Invoke-RestMethod -Method Post -Uri "$base/api/vendas/$($orc.id)/confirmar" -Headers $h
Write-Host "Venda #$($conf.id) status=$($conf.status) total=$($conf.valorTotal)"

Passo "Estoque insuficiente (deve falhar com 422)"
try {
  Invoke-RestMethod -Method Post -Uri "$base/api/vendas/pdv" -Headers $h -ContentType "application/json" -Body (@{
    formaPagamento = "DINHEIRO"; itens = @(@{ produtoId = $mouse.id; quantidade = 99999 })
  } | ConvertTo-Json -Depth 5) | Out-Null
  throw "ERRO: deveria ter sido recusada"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -ne 422) { throw }
  Write-Host "OK - recusada: $($_.ErrorDetails.Message)"
}

Passo "Emitir NF-e da venda PDV"
$nf = Invoke-RestMethod -Method Post -Uri "$base/api/notas-fiscais" -Headers $h -ContentType "application/json" `
  -Body (@{ vendaId = $venda.id } | ConvertTo-Json)
Write-Host "NF-e $($nf.numero) serie $($nf.serie) status=$($nf.status) total=$($nf.valorTotal)"
Write-Host "Chave: $($nf.chaveAcesso)"
Write-Host "Protocolo: $($nf.protocolo)"
$xml = Invoke-WebRequest -Uri "$base/api/notas-fiscais/$($nf.id)/xml" -Headers $h -UseBasicParsing
Write-Host "XML: $($xml.Content.Length) caracteres"

Passo "Pedido de compra e recebimento"
$fornecedor = (Invoke-RestMethod -Uri "$base/api/fornecedores" -Headers $h).content[0]
$cad = $produtos | Where-Object codigo -eq "CAD-200"
$pc = Invoke-RestMethod -Method Post -Uri "$base/api/compras" -Headers $h -ContentType "application/json" -Body (@{
  fornecedorId = $fornecedor.id; quantidadeParcelas = 2; valorFrete = 20
  itens = @(@{ produtoId = $cad.id; quantidade = 40; custoUnitario = 11.50 })
} | ConvertTo-Json -Depth 5)
$rec = Invoke-RestMethod -Method Post -Uri "$base/api/compras/$($pc.id)/receber" -Headers $h -ContentType "application/json" `
  -Body (@{ numeroNotaFornecedor = "98765" } | ConvertTo-Json)
Write-Host "Compra #$($rec.id) status=$($rec.status) total=$($rec.valorTotal)"
$cadDepois = Invoke-RestMethod -Uri "$base/api/produtos/$($cad.id)" -Headers $h
Write-Host "Caderno: estoque $($cad.estoqueAtual) -> $($cadDepois.estoqueAtual), custo medio $($cad.precoCusto) -> $($cadDepois.precoCusto)"

Passo "Financeiro"
$receber = (Invoke-RestMethod -Uri "$base/api/financeiro/receber" -Headers $h).content
$receber | Format-Table id, descricao, valor, vencimento, status -AutoSize
$pagar = (Invoke-RestMethod -Uri "$base/api/financeiro/pagar" -Headers $h).content
$pagar | Format-Table id, descricao, valor, vencimento, status -AutoSize
$baixa = Invoke-RestMethod -Method Post -Uri "$base/api/financeiro/pagar/$($pagar[0].id)/baixa" -Headers $h `
  -ContentType "application/json" -Body (@{ formaPagamento = "BOLETO" } | ConvertTo-Json)
Write-Host "Baixa conta a pagar #$($baixa.id): $($baixa.status)"
$hoje = Get-Date -Format "yyyy-MM-dd"; $fim = (Get-Date).AddDays(90).ToString("yyyy-MM-dd")
Invoke-RestMethod -Uri "$base/api/financeiro/fluxo-caixa?inicio=$hoje&fim=$fim" -Headers $h | Format-List

Passo "Cancelar NF-e e depois a venda"
$nfc = Invoke-RestMethod -Method Post -Uri "$base/api/notas-fiscais/$($nf.id)/cancelar" -Headers $h -ContentType "application/json" `
  -Body (@{ justificativa = "Cliente desistiu da compra apos emissao" } | ConvertTo-Json)
Write-Host "NF-e status=$($nfc.status)"
$vc = Invoke-RestMethod -Method Post -Uri "$base/api/vendas/$($venda.id)/cancelar" -Headers $h -ContentType "application/json" `
  -Body (@{ motivo = "Desistencia do cliente" } | ConvertTo-Json)
Write-Host "Venda #$($vc.id) status=$($vc.status)"

Passo "Dashboard"
Invoke-RestMethod -Uri "$base/api/dashboard" -Headers $h | ConvertTo-Json -Depth 5

Passo "Relatorios"
Invoke-RestMethod -Uri "$base/api/relatorios/vendas?inicio=$hoje&fim=$hoje" -Headers $h | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$base/api/relatorios/curva-abc?inicio=$hoje&fim=$hoje" -Headers $h | Format-Table codigo, faturamento, percentualAcumulado, classe -AutoSize
Invoke-RestMethod -Uri "$base/api/estoque/resumo" -Headers $h | Format-List

Write-Host "`nTODOS OS PASSOS OK" -ForegroundColor Green
