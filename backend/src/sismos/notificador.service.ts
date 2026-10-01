import { Injectable, Logger } from '@nestjs/common';
import { Alerta, EventoSismico } from '@prisma/client';

const TEMPO_LIMITE_MS = 5_000;

// Avisa um sistema externo (Slack, Discord, Teams ou qualquer endpoint) quando nasce um alerta ALTO ou CRITICO.
// Liga-se definindo ALERTA_WEBHOOK_URL. A falha do envio nunca atrapalha a criacao do alerta.
@Injectable()
export class NotificadorService {
  private readonly log = new Logger(NotificadorService.name);

  async alertaAberto(alerta: Alerta, evento: EventoSismico): Promise<void> {
    const url = process.env.ALERTA_WEBHOOK_URL;
    if (!url || (alerta.nivel !== 'ALTO' && alerta.nivel !== 'CRITICO')) return;

    const magnitude = evento.magnitude.toFixed(1).replace('.', ',');
    const texto = `Alerta ${alerta.nivel === 'CRITICO' ? 'CRÍTICO' : 'alto'}: terremoto M${magnitude} em ${evento.local} (${evento.profundidadeKm.toFixed(0)} km de profundidade).`;

    try {
      const resposta = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // "text" (Slack/Teams) e "content" (Discord) com a mesma mensagem, mais os dados estruturados
        body: JSON.stringify({
          text: texto,
          content: texto,
          alerta: {
            id: alerta.id,
            nivel: alerta.nivel,
            titulo: alerta.titulo,
            magnitude: evento.magnitude,
            profundidadeKm: evento.profundidadeKm,
            local: evento.local,
            latitude: evento.latitude,
            longitude: evento.longitude,
            ocorridoEm: evento.ocorridoEm,
          },
        }),
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
      if (!resposta.ok) this.log.warn(`Webhook respondeu ${resposta.status} para o alerta ${alerta.id}.`);
    } catch (erro) {
      this.log.warn(`Nao foi possivel enviar o webhook do alerta ${alerta.id}: ${(erro as Error).message}`);
    }
  }
}
