/**
 * Reduz a foto no navegador antes do envio (lado maior até `max` px, JPEG 85%).
 * Uma foto de celular de 4 MB vira ~150 KB, o que deixa o PDV rápido.
 */
export async function reduzirImagem(arquivo: Blob, max = 1000): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Navegador sem suporte a canvas');
  ctx.fillStyle = '#ffffff'; // PNG com transparência fica com fundo branco
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao converter a imagem'))), 'image/jpeg', 0.85));
}

export const TIPOS_ACEITOS = 'image/jpeg,image/png,image/webp';
