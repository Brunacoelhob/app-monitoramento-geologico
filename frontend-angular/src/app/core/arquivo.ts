import { HttpErrorResponse } from '@angular/common/http';

// Dispara o download de um Blob no navegador.
export function salvarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  // Libera a memoria depois que o navegador iniciou o download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Quando a chamada pede responseType blob, o corpo do erro tambem vem como
// Blob; aqui ele e lido para mostrar a mensagem que o backend mandou.
export async function mensagemDeErro(erro: unknown, padrao: string): Promise<string> {
  if (!(erro instanceof HttpErrorResponse)) return padrao;
  if (erro.status === 0) return 'Nao foi possivel conectar ao servidor.';
  try {
    const corpo = erro.error instanceof Blob ? JSON.parse(await erro.error.text()) : erro.error;
    const mensagem = corpo?.message;
    if (Array.isArray(mensagem)) return mensagem.join(' ');
    if (typeof mensagem === 'string') return mensagem;
  } catch {
    // corpo nao era JSON: usa a mensagem padrao
  }
  return padrao;
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
