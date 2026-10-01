import { Global, Module } from '@nestjs/common';
import { TempoRealController } from './tempo-real.controller';
import { TempoRealService } from './tempo-real.service';

// Global: qualquer modulo pode avisar mudancas sem importar este modulo.
@Global()
@Module({
  controllers: [TempoRealController],
  providers: [TempoRealService],
  exports: [TempoRealService],
})
export class TempoRealModule {}
