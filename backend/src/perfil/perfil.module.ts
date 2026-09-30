import { Module } from '@nestjs/common';
import { ArmazenamentoService } from './armazenamento.service';
import { PerfilController } from './perfil.controller';
import { PerfilService } from './perfil.service';

@Module({
  controllers: [PerfilController],
  providers: [PerfilService, ArmazenamentoService],
})
export class PerfilModule {}
