const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://chvfzqekkmongsrqbwev.supabase.co';
const SUPABASE_KEY = 'sb_publishable_F-Lc83bJD87AokRbHPmltg_hp2q6Ghj';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const RJ_REGIONAL_ID = '80c4e426-d001-4dbf-97f6-f08c7d587829';
const BA_REGIONAL_ID = '3ec67e5d-cbe3-4d50-91fb-80b3cecf4e7e';

async function main() {
  console.log('--- ETAPA 1: Zerar registros da Regional RJ no Supabase ---');
  // Deletar RJ de audit_products
  const { error: delProdRjErr } = await supabase
    .from('audit_products')
    .delete()
    .eq('regional_id', RJ_REGIONAL_ID);
  console.log('Audit products RJ deletados:', delProdRjErr || 'OK');

  // Deletar RJ de lots
  const { error: delLotsRjErr } = await supabase
    .from('lots')
    .delete()
    .eq('regional_id', RJ_REGIONAL_ID);
  console.log('Lots RJ deletados:', delLotsRjErr || 'OK');

  // Deletar RJ de audit_lots
  try {
    await supabase.from('audit_lots').delete().eq('regional_id', RJ_REGIONAL_ID);
  } catch (e) {}

  console.log('\n--- ETAPA 2: Limpar registros anteriores de BA no Supabase ---');
  const { error: delProdBaErr } = await supabase
    .from('audit_products')
    .delete()
    .eq('regional_id', BA_REGIONAL_ID);
  console.log('Audit products BA anteriores limpos:', delProdBaErr || 'OK');

  const { error: delLotsBaErr } = await supabase
    .from('lots')
    .delete()
    .eq('regional_id', BA_REGIONAL_ID);
  console.log('Lots BA anteriores limpos:', delLotsBaErr || 'OK');

  console.log('\n--- ETAPA 3: Ler os 64 registros exatos de BA de hoje ---');
  const excelPath = 'C:\\Users\\User\\Downloads\\Auditoria_VIA_VAREJO_BA (7).xlsx';
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json(sheet);
  console.log(`Linhas lidas da planilha: ${rawRows.length}`);

  if (rawRows.length !== 64) {
    throw new Error(`Esperado exatamente 64 registros, mas foram lidos ${rawRows.length}`);
  }

  // Carregar fotos de evidências de Caixa 01 e Caixa 02 se existirem
  let fotoCaixa1Uri = null;
  let fotoCaixa2Uri = null;
  try {
    const foto1Path = 'C:\\Users\\User\\Downloads\\caixa 1.jpeg';
    if (fs.existsSync(foto1Path)) {
      fotoCaixa1Uri = `data:image/jpeg;base64,${fs.readFileSync(foto1Path).toString('base64')}`;
      console.log('Foto Caixa 01 carregada com sucesso.');
    }
    const foto2Path = 'C:\\Users\\User\\Downloads\\caixa 02.jpeg';
    if (fs.existsSync(foto2Path)) {
      fotoCaixa2Uri = `data:image/jpeg;base64,${fs.readFileSync(foto2Path).toString('base64')}`;
      console.log('Foto Caixa 02 carregada com sucesso.');
    }
  } catch (ePhoto) {
    console.warn('Aviso ao carregar fotos locais:', ePhoto.message);
  }

  const produtosParaSupabase = [];
  const produtosParaCentralJson = [];

  for (let idx = 0; idx < rawRows.length; idx++) {
    const r = rawRows[idx];
    const imei = String(r['IMEI (Bipar / Editar)'] || '').trim();
    const cx = String(r['Caixa'] || 'Caixa 01').trim();
    const lacre = String(r['Lacre Segurança 🔒'] || '').trim();
    const nfOrigem = String(r['NF Origem'] || '').trim();
    const modelo = String(r['Modelo Produto'] || '').trim();
    const sku = String(r['SKU'] || '').trim();
    const fabricante = String(r['Fabricante'] || 'SAMSUNG').trim().toUpperCase();
    const auditor = String(r['Auditor'] || 'Leandro').trim();
    const classificacao = String(r['Classificação'] || 'PRODUTO NA LISTA - SAMSUNG').trim();
    const isLacrado = String(r['Produto Lacrado'] || 'SIM').trim().toUpperCase() === 'SIM' ? 'SIM' : 'NÃO';

    let observacaoFinal = '';
    if (lacre && lacre !== '-') {
      observacaoFinal = `[LACRE:${lacre}]`;
    }

    // Se tiver foto para a caixa e for o primeiro item da caixa, anexar evidência fotográfica
    if (cx === 'Caixa 01' && fotoCaixa1Uri && !produtosParaSupabase.some(p => p.numero_caixa === 'Caixa 01' && p.observacao && p.observacao.includes('[EVIDENCIAS_CAIXA:'))) {
      const evid = {
        caixa: 'Caixa 01',
        regional: 'VIA VAREJO BA',
        fotos: [{ indice: 1, rotulo: 'Foto dos produtos 1', fotoDataUri: fotoCaixa1Uri }]
      };
      observacaoFinal += ` [EVIDENCIAS_CAIXA:${JSON.stringify(evid)}]`;
    } else if (cx === 'Caixa 02' && fotoCaixa2Uri && !produtosParaSupabase.some(p => p.numero_caixa === 'Caixa 02' && p.observacao && p.observacao.includes('[EVIDENCIAS_CAIXA:'))) {
      const evid = {
        caixa: 'Caixa 02',
        regional: 'VIA VAREJO BA',
        fotos: [{ indice: 1, rotulo: 'Foto dos produtos 1', fotoDataUri: fotoCaixa2Uri }]
      };
      observacaoFinal += ` [EVIDENCIAS_CAIXA:${JSON.stringify(evid)}]`;
    }

    const nfFormatada = (nfOrigem && nfOrigem !== '-' && nfOrigem !== 'NÃO LOCALIZADA NA BASE') ? nfOrigem : null;

    // Registro para Supabase
    produtosParaSupabase.push({
      id_local: `BA-20260924-${String(idx + 1).padStart(3, '0')}`,
      serial: imei,
      imei: imei,
      ean: sku !== 'NT' && sku !== '-' ? sku : '78925091334',
      sku: sku !== 'NT' && sku !== '-' ? sku : null,
      modelo: modelo,
      fabricante: fabricante,
      numero_lote: '01',
      numero_caixa: cx,
      regional_id: BA_REGIONAL_ID,
      produto_lacrado: isLacrado,
      kit_completo: null,
      aparelho_marcas_uso: null,
      observacao: observacaoFinal.trim() || null,
      usuario_bipagem: auditor,
      status_sincronizacao: 'ENVIADO',
      data_auditoria: '2026-09-24',
      source_type: classificacao.includes('PRODUTO NA LISTA') ? 'LISTED' : 'OUT_OF_LIST',
      dealer: 'SAMSUNG',
      origin_invoice: nfFormatada,
      brand: fabricante,
      misuse: false
    });

    // Registro para central_database.json
    produtosParaCentralJson.push({
      id: 20260924000 + idx + 1,
      id_local: `BA-20260924-${String(idx + 1).padStart(3, '0')}`,
      id_servidor: `SRV-BA-${Date.now()}-${idx + 1}`,
      serial: imei,
      imei: imei,
      ean: sku !== 'NT' && sku !== '-' ? sku : '',
      sku: sku !== 'NT' && sku !== '-' ? sku : '',
      modelo_produto: modelo,
      fabricante: fabricante,
      brand: fabricante,
      numero_lote: '01',
      numero_caixa: cx,
      box_name: cx,
      regional: 'VIA VAREJO BA',
      produto_lacrado: isLacrado,
      kit_completo: 'SIM',
      aparelho_marcas_uso: 'NÃO',
      lacre_seguranca: (lacre && lacre !== '-') ? lacre : null,
      observacao: (lacre && lacre !== '-') ? `[LACRE:${lacre}]` : '',
      usuario_cadastro: auditor,
      usuario_sincronizacao: auditor,
      data_auditoria: '24/09/2026',
      data_sincronizacao: '2026-09-24T16:09:11.000Z',
      status_sincronizacao: 'ENVIADO',
      sync_status: 'ENVIADO',
      origin_invoice: nfFormatada,
      nf_origem: nfFormatada,
      nf_origem_samsung: nfFormatada,
      classificacao_produto: classificacao,
      product_classification: classificacao,
      box_classification: classificacao,
      source_type: classificacao.includes('PRODUTO NA LISTA') ? 'LISTED' : 'OUT_OF_LIST',
      dealer: 'SAMSUNG',
      computador_id: 'PC-BA-001',
      computador_nome: 'PC-BA-001'
    });
  }

  console.log(`\n--- ETAPA 4: Inserindo os ${produtosParaSupabase.length} produtos de BA no Supabase ---`);
  // Inserir em lotes de 20 para evitar limites de payload
  for (let i = 0; i < produtosParaSupabase.length; i += 20) {
    const chunk = produtosParaSupabase.slice(i, i + 20);
    const { data: insData, error: insErr } = await supabase.from('audit_products').insert(chunk).select('id');
    if (insErr) {
      console.error(`Erro ao inserir lote ${i} - ${i + chunk.length}:`, insErr);
      throw insErr;
    }
    console.log(`Inseridos ${i + (insData ? insData.length : chunk.length)} de ${produtosParaSupabase.length} no Supabase.`);
  }

  console.log('\n--- ETAPA 5: Inserir Lote 01 Finalizado de BA no Supabase ---');
  const lotRecord = {
    numero_lote: '01',
    regional_id: BA_REGIONAL_ID,
    status: 'FINALIZADO',
    total_caixas: 7,
    total_produtos: 64,
    fechado_por: 'Leandro',
    data_fechamento: '2026-09-24T16:09:11.000Z'
  };
  const { error: lotErr } = await supabase.from('lots').insert([lotRecord]);
  console.log('Lote inserido no Supabase:', lotErr || 'OK');

  console.log('\n--- ETAPA 6: Gravar central_database.json e central_envios.json locais ---');
  const centralFotos = [];
  if (fotoCaixa1Uri) {
    centralFotos.push({
      id: 'FOTO-VIAVAREJOBA-CAIXA01-1',
      regional: 'VIA VAREJO BA',
      caixa: 'Caixa 01',
      grupoNumero: 1,
      grupoRotulo: 'Foto dos produtos 1',
      fotoDataUri: fotoCaixa1Uri,
      dataCriacao: '2026-09-24T13:52:01.000Z',
      status_sincronizacao: 'ENVIADO'
    });
  }
  if (fotoCaixa2Uri) {
    centralFotos.push({
      id: 'FOTO-VIAVAREJOBA-CAIXA02-1',
      regional: 'VIA VAREJO BA',
      caixa: 'Caixa 02',
      grupoNumero: 1,
      grupoRotulo: 'Foto dos produtos 1',
      fotoDataUri: fotoCaixa2Uri,
      dataCriacao: '2026-09-24T13:52:11.000Z',
      status_sincronizacao: 'ENVIADO'
    });
  }

  const centralDbPayload = {
    produtos: produtosParaCentralJson,
    fotos: centralFotos,
    ultimaAtualizacao: new Date().toISOString()
  };

  const centralEnviosPayload = [
    {
      id: 'ENV-BA-20260924-001',
      tipo: 'ENVIAR_ONLINE',
      regional: 'VIA VAREJO BA',
      computador: { id: 'PC-BA-001', nome: 'PC-BA-001' },
      usuario: { login: 'leandro', nome: 'Leandro' },
      data_envio: '2026-09-24T16:09:11.000Z',
      total_produtos: 64,
      status: 'SUCESSO',
      mensagem: 'Sincronização de 64 produtos finalizados da Regional BA realizada com sucesso.'
    }
  ];

  fs.writeFileSync(path.resolve(process.cwd(), 'data/central_database.json'), JSON.stringify(centralDbPayload, null, 2), 'utf-8');
  fs.writeFileSync(path.resolve(process.cwd(), 'data/central_envios.json'), JSON.stringify(centralEnviosPayload, null, 2), 'utf-8');
  console.log('central_database.json e central_envios.json gravados com sucesso.');

  console.log('\n--- ETAPA 7: Verificação Final no Supabase ---');
  const { count: countTotal } = await supabase.from('audit_products').select('*', { count: 'exact', head: true });
  const { count: countBa } = await supabase.from('audit_products').select('*', { count: 'exact', head: true }).eq('regional_id', BA_REGIONAL_ID);
  const { count: countRj } = await supabase.from('audit_products').select('*', { count: 'exact', head: true }).eq('regional_id', RJ_REGIONAL_ID);

  console.log(`TOTAL NO SUPABASE: ${countTotal}`);
  console.log(`VIA VAREJO BA NO SUPABASE: ${countBa} (Esperado: 64)`);
  console.log(`VIA VAREJO RJ NO SUPABASE: ${countRj} (Esperado: 0)`);
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
