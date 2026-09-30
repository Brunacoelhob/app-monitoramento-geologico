import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Sentido, Totais } from '../../../../core/modelos';

export type TipoKpi = 'total' | 'media' | 'salas' | 'amplitude';

export interface DadosDetalheKpi {
  tipo: TipoKpi;
  totais: Totais;
  inicio: string; // AAAA-MM-DD
  fim: string;
}

interface Linha {
  rotulo: string;
  texto: string;
  // 0 a 1: largura da barra (opcional)
  proporcao?: number;
  cor?: string;
}

const ROTULOS: Record<Sentido, string> = { INTERNO: 'Interno', EXTERNO: 'Externo' };
// Usa as variaveis do tema (frio/calor) para acompanhar claro/escuro.
const CORES: Record<Sentido, string> = { INTERNO: 'var(--frio)', EXTERNO: 'var(--calor)' };

const inteiro = new Intl.NumberFormat('pt-BR');
const decimal = (n: number, casas = 1) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const dataBr = (iso: string) => iso.split('-').reverse().join('/');

// Modal com o significado de cada indicador, como ele e calculado e o detalhe por sentido.
@Component({
  selector: 'app-detalhe-kpi-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './detalhe-kpi-dialog.html',
  styleUrl: './detalhe-kpi-dialog.scss',
})
export class DetalheKpiDialog {
  private readonly dados = inject<DadosDetalheKpi>(MAT_DIALOG_DATA);

  protected readonly periodo = `${dataBr(this.dados.inicio)} a ${dataBr(this.dados.fim)}`;

  protected readonly conteudo = computed(() => {
    const { tipo, totais } = this.dados;
    const dias =
      Math.round((new Date(this.dados.fim).getTime() - new Date(this.dados.inicio).getTime()) / 86_400_000) + 1;
    const sentidos = totais.porSentido;

    switch (tipo) {
      case 'total': {
        const linhas: Linha[] = sentidos.map((s) => ({
          rotulo: ROTULOS[s.sentido],
          texto: `${inteiro.format(s.leituras)} (${decimal((s.leituras / (totais.totalLeituras || 1)) * 100, 1)}%)`,
          proporcao: s.leituras / (totais.totalLeituras || 1),
          cor: CORES[s.sentido],
        }));
        linhas.push({ rotulo: 'Média por dia', texto: `${inteiro.format(Math.round(totais.totalLeituras / dias))} leituras` });
        return {
          titulo: 'Total de leituras',
          icone: 'dataset',
          tom: 'azul',
          destaque: inteiro.format(totais.totalLeituras),
          unidade: 'leituras',
          explicacao:
            'Cada leitura é um registro de temperatura enviado por um sensor. Este número mostra quantos registros existem no período e nos sentidos selecionados.',
          calculo: 'Contagem simples de todos os registros entre as datas escolhidas.',
          titulo_linhas: 'Distribuição por sentido',
          linhas,
          dica: 'Se um sentido tem bem menos leituras que o outro, as médias dele são menos representativas.',
        };
      }

      case 'media': {
        const maior = Math.max(...sentidos.map((s) => s.media), 1);
        const linhas: Linha[] = sentidos.map((s) => ({
          rotulo: ROTULOS[s.sentido],
          texto: `${decimal(s.media, 2)} °C`,
          proporcao: s.media / maior,
          cor: CORES[s.sentido],
        }));
        const interno = sentidos.find((s) => s.sentido === 'INTERNO');
        const externo = sentidos.find((s) => s.sentido === 'EXTERNO');
        if (interno && externo) {
          const diferenca = externo.media - interno.media;
          linhas.push({
            rotulo: 'Diferença externo − interno',
            texto: `${diferenca >= 0 ? '+' : ''}${decimal(diferenca, 2)} °C`,
          });
        }
        return {
          titulo: 'Temperatura média',
          icone: 'device_thermostat',
          tom: 'laranja',
          destaque: totais.temperaturaMedia !== null ? decimal(totais.temperaturaMedia, 2) : '—',
          unidade: '°C',
          explicacao:
            'É a temperatura típica do período: um valor central que resume todas as leituras, sem se deixar levar por picos isolados de calor ou frio.',
          calculo: 'Soma de todas as temperaturas dividida pelo número de leituras (média aritmética).',
          titulo_linhas: 'Média por sentido',
          linhas,
          dica: 'Compare interno e externo: uma diferença grande indica forte influência do ambiente externo.',
        };
      }

      case 'salas': {
        const salas = totais.salasMonitoradas;
        return {
          titulo: 'Salas monitoradas',
          icone: 'meeting_room',
          tom: 'verde',
          destaque: inteiro.format(salas),
          unidade: salas === 1 ? 'sala' : 'salas',
          explicacao:
            'Quantidade de ambientes que enviaram ao menos uma leitura no período. Cada sala tem sensores instalados que registram a temperatura.',
          calculo: 'Contagem de salas diferentes que aparecem nas leituras do período.',
          titulo_linhas: 'Detalhes',
          linhas: [
            { rotulo: 'Leituras por sala (média)', texto: `${inteiro.format(Math.round(totais.totalLeituras / (salas || 1)))} leituras` },
            { rotulo: 'Dias no período', texto: `${inteiro.format(dias)} dias` },
          ],
          dica: 'Uma sala que some do painel pode indicar sensor desligado ou sem comunicação.',
        };
      }

      case 'amplitude': {
        const minimas = sentidos.map((s) => s.minima);
        const maximas = sentidos.map((s) => s.maxima);
        const minima = minimas.length ? Math.min(...minimas) : 0;
        const maxima = maximas.length ? Math.max(...maximas) : 0;
        const linhas: Linha[] = sentidos.map((s) => ({
          rotulo: ROTULOS[s.sentido],
          texto: `${decimal(s.minima)} °C a ${decimal(s.maxima)} °C  (variação de ${decimal(s.maxima - s.minima)} °C)`,
          proporcao: (s.maxima - s.minima) / (maxima - minima || 1),
          cor: CORES[s.sentido],
        }));
        return {
          titulo: 'Variação de temperatura',
          icone: 'swap_vert',
          tom: 'roxo',
          destaque: sentidos.length ? decimal(maxima - minima) : '—',
          unidade: '°C',
          explicacao: `Diferença entre a temperatura mais alta (${decimal(maxima)} °C) e a mais baixa (${decimal(minima)} °C) registradas no período. Mostra o quanto a temperatura oscilou.`,
          calculo: 'Maior temperatura registrada menos a menor temperatura registrada.',
          titulo_linhas: 'Variação por sentido',
          linhas,
          dica: 'Variações muito altas podem indicar falha de sensor ou mudança brusca no ambiente.',
        };
      }
    }
  });
}
