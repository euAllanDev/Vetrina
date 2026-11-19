import { api } from './api';

/** Abre o diálogo de impressão do DANFE (o usuário pode escolher "Salvar como PDF"). */
export async function imprimirDanfe(notaId: number): Promise<void> {
  const blob = await api.blob(`/notas-fiscais/${notaId}/danfe`);
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  frame.src = url;
  document.body.appendChild(frame);
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, '_blank'); // navegador sem impressão de PDF embutido: abre em nova aba
    }
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000);
  };
}

/** Baixa o DANFE como arquivo PDF. */
export async function baixarDanfe(notaId: number, chave: string): Promise<void> {
  const blob = await api.blob(`/notas-fiscais/${notaId}/danfe?download=true`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DANFE-${chave}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
