import { Module } from '@nestjs/common';
import { ImportacaoService } from './importacao.service';
import { LeiturasController } from './leituras.controller';
import { LeiturasService } from './leituras.service';
import { RelatoriosService } from './relatorios.service';

@Module({
  controllers: [LeiturasController],
  providers: [LeiturasService, RelatoriosService, ImportacaoService],
})
export class LeiturasModule {}
