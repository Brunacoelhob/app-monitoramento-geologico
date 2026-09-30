import { Module } from '@nestjs/common';
import { LeiturasController } from './leituras.controller';
import { LeiturasService } from './leituras.service';
import { RelatoriosService } from './relatorios.service';

@Module({
  controllers: [LeiturasController],
  providers: [LeiturasService, RelatoriosService],
})
export class LeiturasModule {}
