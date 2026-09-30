// Valida as variaveis de ambiente na partida: falha cedo se algo estiver errado.

export function validarVariaveis(config: Record<string, unknown>) {
  const obrigatorias = ['DATABASE_URL', 'JWT_SECRET'];
  for (const nome of obrigatorias) {
    if (!config[nome]) {
      throw new Error(`Variavel de ambiente '${nome}' nao definida. Veja o .env.example.`);
    }
  }

  // Segredo curto e facil de adivinhar quebra a seguranca dos tokens.
  if (String(config.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres.');
  }

  return config;
}
