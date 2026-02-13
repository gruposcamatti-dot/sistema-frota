// Helper function to map expense class to column
export const mapClassToColumn = (category) => {
  if (!category) return '';
  const normalizedCategory = category.toLowerCase().trim();
  
  // Combustível
  if (normalizedCategory.includes('combustível') || 
      normalizedCategory.includes('combustivel') ||
      normalizedCategory.includes('oleo diesel')) {
    return 'combustivel';
  }
  
  // Despesas Gerais
  if (normalizedCategory.includes('serviços de guincho') ||
      normalizedCategory.includes('servicos de guincho') ||
      normalizedCategory.includes('rat desp financeiras') ||
      normalizedCategory.includes('moto taxi') ||
      normalizedCategory.includes('material de seguranca e protecao') ||
      normalizedCategory.includes('mat. segurança e prot. veículos') ||
      normalizedCategory.includes('mat. seguranca e prot. veiculos') ||
      normalizedCategory.includes('despesas de viagens e hospedagens') ||
      normalizedCategory.includes('epi\'s') ||
      normalizedCategory.includes('despesas administrativas') ||
      normalizedCategory.includes('epis') ||
      normalizedCategory.includes('lavagem de frotas') ||
      normalizedCategory.includes('refeicao e lanches')) {
    return 'despesasGerais';
  }
  
  // Manutenção Preventiva
  if (normalizedCategory.includes('manut. preventiva') ||
      normalizedCategory.includes('manutencao preventiva')) {
    return 'manutencaoPreventiva';
  }
  
  // Manutenção Corretiva
  if (normalizedCategory.includes('manut. corretiva') ||
      normalizedCategory.includes('manutencao corretiva') ||
      normalizedCategory.includes('manut. maquinas e equipamentos') ||
      normalizedCategory.includes('manutencao / pecas e aces. veiculos') ||
      normalizedCategory.includes('material de uso e consumo') ||
      normalizedCategory.includes('ferramentas') ||
      normalizedCategory.includes('manut. por acidente') ||
      normalizedCategory.includes('servicos de terceiros') ||
      normalizedCategory.includes('ordenados')) {
    return 'manutencaoCorretiva';
  }
  
  // Manutenção Reforma
  if (normalizedCategory.includes('reforma de frota') ||
      normalizedCategory.includes('reforma de veiculos')) {
    return 'manutencaoReforma';
  }
  
  // Fretes
  if (normalizedCategory.includes('fretes s/ compras') ||
      normalizedCategory.includes('fretes')) {
    return 'fretes';
  }
  
  // Pneus Borracharia
  if (normalizedCategory.includes('servicos de pneus') ||
      normalizedCategory.includes('borracharia')) {
    return 'pneusBorracharia';
  }
  
  // Pneus Novos
  if (normalizedCategory.includes('pneus e cameras - novos') ||
      (normalizedCategory.includes('pneus') && normalizedCategory.includes('novos'))) {
    return 'pneusNovos';
  }
  
  // Ressolagem
  if (normalizedCategory.includes('pneus ressolados') ||
      normalizedCategory.includes('ressolados')) {
    return 'ressolagem';
  }
  
  // Pedágio
  if (normalizedCategory.includes('pedagio')) {
    return 'pedagio';
  }
  
  // Rastreamento
  if (normalizedCategory.includes('mensalidades')) {
    return 'rastreamento';
  }
  
  // Seguro
  if (normalizedCategory.includes('seguros') && !normalizedCategory.includes('obrigatorio')) {
    return 'seguro';
  }
  
  // DPVAT
  if (normalizedCategory.includes('dpvat') ||
      normalizedCategory.includes('seguro obrigatorio')) {
    return 'dpvat';
  }
  
  // Licenciamento
  if (normalizedCategory.includes('licenciamento') ||
      normalizedCategory.includes('taxa de cobranca') ||
      normalizedCategory.includes('taxa de cobrança') ||
      normalizedCategory.includes('taxas inmetro') ||
      normalizedCategory.includes('antt') ||
      normalizedCategory.includes('inspecao veicular') ||
      normalizedCategory.includes('inspeçao veicular') ||
      normalizedCategory.includes('emplacamento de veiculo') ||
      normalizedCategory.includes('emplacamento de veículo') ||
      normalizedCategory.includes('servicos despachante policial') ||
      normalizedCategory.includes('serviços despachante policial')) {
    return 'licenciamento';
  }
  
  // Melhorias
  if (normalizedCategory.includes('melhoria em frotas') ||
      normalizedCategory.includes('melhorias')) {
    return 'melhorias';
  }
  
  // Default: return empty string (não mapeado)
  return '';
};
