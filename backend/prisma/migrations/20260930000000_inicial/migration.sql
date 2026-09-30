-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Sentido" AS ENUM ('INTERNO', 'EXTERNO');

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'VISUALIZADOR');

-- CreateTable
CREATE TABLE "leituras_temperatura" (
    "id" TEXT NOT NULL,
    "sala" TEXT NOT NULL,
    "data_leitura" TIMESTAMP(0) NOT NULL,
    "temperatura" DECIMAL(5,1) NOT NULL,
    "sentido" "Sentido" NOT NULL,

    CONSTRAINT "leituras_temperatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'VISUALIZADOR',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leituras_temperatura_data_leitura_idx" ON "leituras_temperatura"("data_leitura");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

