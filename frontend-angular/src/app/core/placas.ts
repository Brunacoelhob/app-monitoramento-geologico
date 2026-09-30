// Codigos das placas no arquivo de limites (Bird, 2003) e seus nomes em portugues
export const NOME_PLACA: Record<string, string> = {
  AF: 'África', AM: 'Amur', AN: 'Antártica', AP: 'Altiplano', AR: 'Arábia', AS: 'Egeu', AT: 'Anatólia', AU: 'Austrália',
  BH: 'Cabeça de Pássaro', BR: 'Balmoral Reef', BS: 'Mar de Banda', BU: 'Birmânia', CA: 'Caribe', CL: 'Carolinas',
  CO: 'Cocos', CR: 'Conway Reef', EA: 'Páscoa', EU: 'Eurásia', FT: 'Futuna', GP: 'Galápagos', IN: 'Índia', JF: 'Juan de Fuca',
  JZ: 'Juan Fernández', KE: 'Kermadec', MA: 'Marianas', MN: 'Manus', MO: 'Maoke', MS: 'Mar das Molucas', NA: 'América do Norte',
  NB: 'Bismarck Norte', ND: 'Andes do Norte', NH: 'Novas Hébridas', NI: 'Niuafo’ou', NZ: 'Nazca', OK: 'Okhotsk', ON: 'Okinawa',
  PA: 'Pacífica', PM: 'Panamá', PS: 'Mar das Filipinas', RI: 'Rivera', SA: 'América do Sul', SB: 'Bismarck Sul', SC: 'Scotia',
  SL: 'Shetland', SO: 'Somália', SS: 'Mar das Salomão', SU: 'Sunda', SW: 'Sanduíche', TI: 'Timor', TO: 'Tonga', WL: 'Woodlark', YA: 'Yangtzé',
};
export const nomePlaca = (codigo: string) => NOME_PLACA[codigo] ?? codigo;
