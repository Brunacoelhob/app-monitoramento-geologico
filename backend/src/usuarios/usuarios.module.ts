import { Module } from '@nestjs/common';
import { ArmazenamentoService } from '../perfil/armazenamento.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService, ArmazenamentoService],
})
export class UsuariosModule {}
