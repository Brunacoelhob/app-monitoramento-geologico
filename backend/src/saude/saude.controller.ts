import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Publica } from '../auth/decoradores';
import { ErroApi } from '../comum/respostas.dto';
import { PrismaService } from '../prisma/prisma.service';

const INICIO = Date.now();

export class SaudeResposta {
  @ApiProperty({ example: 'ok', description: '"ok" quando a API e o banco respondem.' }) status: string;
  @ApiProperty({ example: 'ok' }) banco: string;
  @ApiProperty({ example: 3725, description: 'Segundos desde que a API foi iniciada.' }) uptimeSegundos: number;
  @ApiProperty({ example: '2026-09-30T19:45:13.000Z' }) agora: string;
}

// Usada pelo Docker (healthcheck) e por monitores externos. Nao exige login.
@ApiTags('Saúde')
@Controller('saude')
export class SaudeController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({
    summary: 'Verificar se a API está no ar',
    description: 'Confere a API e a conexão com o banco (`SELECT 1`). Pública e sem limite de requisições, para healthchecks.',
  })
  @ApiOkResponse({ description: 'API e banco funcionando.', type: SaudeResposta })
  @ApiServiceUnavailableResponse({ description: 'A API está no ar, mas o banco não respondeu.', type: ErroApi })
  @Publica()
  @SkipThrottle()
  @Get()
  async verificar(): Promise<SaudeResposta> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('O banco de dados não respondeu.');
    }
    return {
      status: 'ok',
      banco: 'ok',
      uptimeSegundos: Math.round((Date.now() - INICIO) / 1000),
      agora: new Date().toISOString(),
    };
  }
}
