// Anima uma lista de valores de "de" ate "para" (ease-out) chamando aoMudar a cada quadro.
// Devolve uma funcao que cancela a animacao. Respeita "reduzir movimento".
export function animarValores(
  de: number[],
  para: number[],
  aoMudar: (valores: number[]) => void,
  duracao = 1100,
): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    aoMudar(para);
    return () => undefined;
  }

  let quadro = 0;
  const comeco = performance.now();
  const passo = (agora: number) => {
    const progresso = Math.min((agora - comeco) / duracao, 1);
    const suave = 1 - Math.pow(1 - progresso, 3);
    aoMudar(para.map((alvo, i) => (de[i] ?? alvo) + (alvo - (de[i] ?? alvo)) * suave));
    if (progresso < 1) quadro = requestAnimationFrame(passo);
  };
  quadro = requestAnimationFrame(passo);
  return () => cancelAnimationFrame(quadro);
}
