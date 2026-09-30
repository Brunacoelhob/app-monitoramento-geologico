-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "avatar_arquivo" TEXT,
ADD COLUMN     "avatar_mime" TEXT,
ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "celular" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "nome" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "uf" TEXT;

-- CreateTable
CREATE TABLE "imagens" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "nome_original" TEXT NOT NULL,
    "arquivo" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imagens_arquivo_key" ON "imagens"("arquivo");

-- CreateIndex
CREATE INDEX "imagens_usuario_id_idx" ON "imagens"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_cpf_key" ON "usuarios"("cpf");

-- AddForeignKey
ALTER TABLE "imagens" ADD CONSTRAINT "imagens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

