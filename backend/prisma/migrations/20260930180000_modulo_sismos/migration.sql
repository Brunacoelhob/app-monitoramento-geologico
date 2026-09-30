-- CreateEnum
CREATE TYPE "TipoSensor" AS ENUM ('TEMPERATURA', 'SISMOGRAFO', 'GPS');

-- CreateEnum
CREATE TYPE "Origem" AS ENUM ('REAL', 'SIMULADO');

-- CreateEnum
CREATE TYPE "SituacaoEvento" AS ENUM ('AUTOMATICO', 'REVISADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('SISMO', 'SEM_COMUNICACAO');

-- CreateEnum
CREATE TYPE "NivelAlerta" AS ENUM ('ATENCAO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "EstadoAlerta" AS ENUM ('ABERTO', 'RECONHECIDO', 'ENCERRADO');

-- AlterTable
ALTER TABLE "leituras_temperatura" ADD COLUMN     "estacao_id" INTEGER,
ADD COLUMN     "origem" "Origem" NOT NULL DEFAULT 'REAL';

-- CreateTable
CREATE TABLE "estacoes" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "placa" TEXT,
    "origem" "Origem" NOT NULL DEFAULT 'REAL',
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "monitora_comunicacao" BOOLEAN NOT NULL DEFAULT true,
    "chave_hash" TEXT,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensores" (
    "id" SERIAL NOT NULL,
    "estacao_id" INTEGER NOT NULL,
    "tipo" "TipoSensor" NOT NULL,
    "nome" TEXT NOT NULL,
    "sentido" "Sentido",
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sensores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leituras_sismografo" (
    "id" SERIAL NOT NULL,
    "sensor_id" INTEGER NOT NULL,
    "instante" TIMESTAMPTZ(3) NOT NULL,
    "amplitude" DOUBLE PRECISION NOT NULL,
    "origem" "Origem" NOT NULL,

    CONSTRAINT "leituras_sismografo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leituras_gps" (
    "id" SERIAL NOT NULL,
    "sensor_id" INTEGER NOT NULL,
    "instante" TIMESTAMPTZ(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "altitude_m" DOUBLE PRECISION,
    "deslocamento_leste_mm" DOUBLE PRECISION,
    "deslocamento_norte_mm" DOUBLE PRECISION,
    "origem" "Origem" NOT NULL,

    CONSTRAINT "leituras_gps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_sismicos" (
    "id" SERIAL NOT NULL,
    "id_externo" TEXT NOT NULL,
    "magnitude" DOUBLE PRECISION NOT NULL,
    "profundidade_km" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "local" TEXT NOT NULL,
    "ocorrido_em" TIMESTAMPTZ(3) NOT NULL,
    "origem" "Origem" NOT NULL DEFAULT 'REAL',
    "situacao" "SituacaoEvento" NOT NULL DEFAULT 'AUTOMATICO',
    "atualizado_usgs_em" TIMESTAMPTZ(3),
    "alerta_replica_id" INTEGER,

    CONSTRAINT "eventos_sismicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "nivel" "NivelAlerta" NOT NULL,
    "nivel_anterior" "NivelAlerta",
    "estado" "EstadoAlerta" NOT NULL DEFAULT 'ABERTO',
    "titulo" TEXT NOT NULL,
    "evento_id" INTEGER,
    "estacao_id" INTEGER,
    "aberto_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconhecido_em" TIMESTAMPTZ(3),
    "reconhecido_por_id" INTEGER,
    "encerrado_em" TIMESTAMPTZ(3),
    "encerrado_por_id" INTEGER,
    "motivo_encerramento" TEXT,
    "encerrado_automatico" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerta_historico" (
    "id" SERIAL NOT NULL,
    "alerta_id" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "detalhes" TEXT,
    "usuario_id" INTEGER,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerta_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estacoes_codigo_key" ON "estacoes"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estacoes_chave_hash_key" ON "estacoes"("chave_hash");

-- CreateIndex
CREATE INDEX "sensores_estacao_id_idx" ON "sensores"("estacao_id");

-- CreateIndex
CREATE INDEX "leituras_sismografo_instante_idx" ON "leituras_sismografo"("instante");

-- CreateIndex
CREATE UNIQUE INDEX "leituras_sismografo_sensor_id_instante_key" ON "leituras_sismografo"("sensor_id", "instante");

-- CreateIndex
CREATE INDEX "leituras_gps_instante_idx" ON "leituras_gps"("instante");

-- CreateIndex
CREATE UNIQUE INDEX "leituras_gps_sensor_id_instante_key" ON "leituras_gps"("sensor_id", "instante");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_sismicos_id_externo_key" ON "eventos_sismicos"("id_externo");

-- CreateIndex
CREATE INDEX "eventos_sismicos_ocorrido_em_idx" ON "eventos_sismicos"("ocorrido_em");

-- CreateIndex
CREATE INDEX "eventos_sismicos_magnitude_idx" ON "eventos_sismicos"("magnitude");

-- CreateIndex
CREATE UNIQUE INDEX "alertas_evento_id_key" ON "alertas"("evento_id");

-- CreateIndex
CREATE INDEX "alertas_estado_nivel_idx" ON "alertas"("estado", "nivel");

-- CreateIndex
CREATE INDEX "alertas_aberto_em_idx" ON "alertas"("aberto_em");

-- CreateIndex
CREATE INDEX "alerta_historico_alerta_id_idx" ON "alerta_historico"("alerta_id");

-- CreateIndex
CREATE INDEX "leituras_temperatura_estacao_id_sentido_data_leitura_idx" ON "leituras_temperatura"("estacao_id", "sentido", "data_leitura");

-- AddForeignKey
ALTER TABLE "leituras_temperatura" ADD CONSTRAINT "leituras_temperatura_estacao_id_fkey" FOREIGN KEY ("estacao_id") REFERENCES "estacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensores" ADD CONSTRAINT "sensores_estacao_id_fkey" FOREIGN KEY ("estacao_id") REFERENCES "estacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leituras_sismografo" ADD CONSTRAINT "leituras_sismografo_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "sensores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leituras_gps" ADD CONSTRAINT "leituras_gps_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "sensores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_sismicos" ADD CONSTRAINT "eventos_sismicos_alerta_replica_id_fkey" FOREIGN KEY ("alerta_replica_id") REFERENCES "alertas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos_sismicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_estacao_id_fkey" FOREIGN KEY ("estacao_id") REFERENCES "estacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta_historico" ADD CONSTRAINT "alerta_historico_alerta_id_fkey" FOREIGN KEY ("alerta_id") REFERENCES "alertas"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RN-03: as leituras de temperatura que ja existiam passam a pertencer a uma estacao "legado".
-- Ela nao tem chave de API (nao recebe leituras novas) e nao gera alerta de silencio.
INSERT INTO "estacoes" ("codigo", "nome", "origem", "ativa", "monitora_comunicacao")
VALUES ('LEGADO-SALA-ADMIN', 'Sala Admin (legado)', 'REAL', true, false);

INSERT INTO "sensores" ("estacao_id", "tipo", "nome", "sentido")
SELECT id, 'TEMPERATURA', 'Temperatura interna', 'INTERNO' FROM "estacoes" WHERE "codigo" = 'LEGADO-SALA-ADMIN';

INSERT INTO "sensores" ("estacao_id", "tipo", "nome", "sentido")
SELECT id, 'TEMPERATURA', 'Temperatura externa', 'EXTERNO' FROM "estacoes" WHERE "codigo" = 'LEGADO-SALA-ADMIN';

UPDATE "leituras_temperatura"
SET "estacao_id" = (SELECT id FROM "estacoes" WHERE "codigo" = 'LEGADO-SALA-ADMIN')
WHERE "estacao_id" IS NULL;
