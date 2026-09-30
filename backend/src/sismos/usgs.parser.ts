import { SituacaoEvento } from '@prisma/client';

export interface EventoUsgs {
  idExterno: string;
  magnitude: number;
  profundidadeKm: number;
  latitude: number;
  longitude: number;
  local: string;
  ocorridoEm: Date;
  situacao: SituacaoEvento;
  atualizadoEm: Date;
}

// Converte a resposta GeoJSON do USGS nos nossos eventos (RN-12).
// Itens sem magnitude ou sem coordenadas sao ignorados.
export function lerGeoJsonUsgs(geojson: unknown): EventoUsgs[] {
  const features = (geojson as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return [];

  const eventos: EventoUsgs[] = [];
  for (const item of features) {
    const f = item as {
      id?: string;
      properties?: { mag?: number | null; place?: string | null; time?: number; updated?: number; status?: string };
      geometry?: { coordinates?: number[] };
    };
    const [longitude, latitude, profundidade] = f.geometry?.coordinates ?? [];
    const p = f.properties;
    if (!f.id || !p || typeof p.mag !== 'number' || typeof p.time !== 'number') continue;
    if (![longitude, latitude].every(Number.isFinite)) continue;

    eventos.push({
      idExterno: f.id,
      magnitude: p.mag,
      profundidadeKm: Number.isFinite(profundidade) ? profundidade : 0,
      latitude,
      longitude,
      local: p.place?.trim() || 'Local não informado',
      ocorridoEm: new Date(p.time),
      // "deleted" = o USGS retirou o evento; "reviewed" = revisado por analista
      situacao: p.status === 'deleted' ? 'CANCELADO' : p.status === 'reviewed' ? 'REVISADO' : 'AUTOMATICO',
      atualizadoEm: new Date(p.updated ?? p.time),
    });
  }
  return eventos;
}
