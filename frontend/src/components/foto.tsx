import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Icon } from './icons';
import { Button } from './ui';
import { TIPOS_ACEITOS } from '../lib/imagem';

/** Foto do produto ou, sem foto, um quadro neutro com o ícone de pacote. */
export function ProdutoFoto({ url, alt, size, className = '' }: { url: string | null; alt: string; size?: number; className?: string }) {
  const [erro, setErro] = useState(false);
  useEffect(() => setErro(false), [url]);
  const style = size ? { width: size, height: size } : undefined;
  if (!url || erro) {
    return (
      <div className={`foto foto-vazia ${className}`} style={style} aria-hidden="true">
        <Icon name="package" size={size ? Math.max(14, Math.round(size * 0.42)) : 28} />
      </div>
    );
  }
  return <img className={`foto ${className}`} style={style} src={url} alt={alt} loading="lazy" decoding="async" onError={() => setErro(true)} />;
}

/** Área para escolher/arrastar a foto, com pré-visualização. */
export function FotoUpload({ url, enviando, onEscolher, onRemover, desabilitado }:
  { url: string | null; enviando?: boolean; onEscolher: (f: File) => void; onRemover?: () => void; desabilitado?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    const f = e.dataTransfer.files?.[0];
    if (f && !desabilitado) onEscolher(f);
  };

  return (
    <div className="foto-upload">
      <button type="button" className={`foto-drop ${arrastando ? 'over' : ''}`} disabled={desabilitado || enviando}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={soltar}
        aria-label={url ? 'Trocar foto do produto' : 'Adicionar foto do produto'}>
        {url ? <img src={url} alt="" /> : (
          <span className="foto-drop-vazio">
            <Icon name="plus" size={20} />
            <span>Adicionar foto</span>
            <span className="muted" style={{ fontSize: 12 }}>Arraste ou clique · JPG, PNG ou WebP</span>
          </span>
        )}
        {enviando && <span className="foto-drop-busy"><span className="spinner" /></span>}
      </button>
      {url && !desabilitado && (
        <div className="row" style={{ marginTop: 8 }}>
          <Button size="sm" onClick={() => input.current?.click()} disabled={enviando}>Trocar</Button>
          {onRemover && <Button size="sm" variant="ghost" icon="trash" onClick={onRemover} disabled={enviando}>Remover</Button>}
        </div>
      )}
      <input ref={input} type="file" accept={TIPOS_ACEITOS} hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onEscolher(f); e.target.value = ''; }} />
    </div>
  );
}
