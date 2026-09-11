const CLOUD_STORAGE_URL = 'https://extendsclass.com/api/json-storage/bin/dcccfea';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Metodo nao permitido. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    const { produtos, computador, usuario, regional } = body || {};
    if (!Array.isArray(produtos) || produtos.length === 0) {
      return res.status(400).json({ erro: 'Nenhum produto enviado para sincronizacao.' });
    }

    let cloudData: { system?: string; produtos: any[]; historico_envios: any[] } = {
      system: 'GRUPO SOLUTIONS AUDITORIA SAMSUNG',
      produtos: [],
      historico_envios: [],
    };

    try {
      const getRes = await fetch(CLOUD_STORAGE_URL);
      if (getRes.ok) {
        const parsed = await getRes.json();
        if (parsed && Array.isArray(parsed.produtos)) {
          cloudData = parsed;
        }
      }
    } catch (e) {
      console.error('Erro ao ler da nuvem:', e);
    }

    const agora = new Date().toISOString();
    let novosCount = 0;
    let duplicadosCount = 0;

    const mapExistentes = new Map<string, any>();
    for (const p of cloudData.produtos) {
      const reg = (p.regional || 'VIA VAREJO RJ').trim().toUpperCase();
      const sn = (p.serial || '').trim().toUpperCase();
      mapExistentes.set(`${reg}:::${sn}`, p);
    }

    const novosAdicionados: any[] = [];
    for (const p of produtos) {
      const reg = (p.regional || regional || 'VIA VAREJO RJ').trim().toUpperCase();
      const sn = (p.serial || '').trim().toUpperCase();
      const chave = `${reg}:::${sn}`;

      if (mapExistentes.has(chave)) {
        duplicadosCount++;
      } else {
        const itemNormalizado = {
          ...p,
          regional: p.regional || regional || 'VIA VAREJO RJ',
          computador_id: p.computador_id || computador?.id || 'PC-001',
          computador_nome: p.computador_nome || computador?.nome || 'Estacao',
          usuario_criacao: p.usuario_criacao || usuario || 'Operador',
          status_sincronizacao: 'ENVIADO',
          sync_status: 'ENVIADO',
          data_sincronizacao: agora,
          sync_data: agora,
          id_servidor: p.id_servidor || `SRV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        };
        cloudData.produtos.unshift(itemNormalizado);
        mapExistentes.set(chave, itemNormalizado);
        novosAdicionados.push(itemNormalizado);
        novosCount++;
      }
    }

    const logEnvio = {
      id: Date.now(),
      data_envio: new Date().toLocaleString('pt-BR'),
      regional: regional || computador?.regional || 'VIA VAREJO RJ',
      computador_id: computador?.id || 'PC-001',
      computador_nome: computador?.nome || 'Estacao',
      usuario: usuario || 'Operador',
      quantidade_enviada: novosCount,
      status: 'OK',
      detalhes: `${novosCount} novos seriais sincronizados na nuvem central (${duplicadosCount} ja existentes mantidos).`,
      timestamp: agora,
    };

    if (!Array.isArray(cloudData.historico_envios)) {
      cloudData.historico_envios = [];
    }
    cloudData.historico_envios.unshift(logEnvio);
    if (cloudData.historico_envios.length > 200) {
      cloudData.historico_envios = cloudData.historico_envios.slice(0, 200);
    }

    await fetch(CLOUD_STORAGE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cloudData),
    });

    return res.status(200).json({
      sucesso: true,
      sincronizados: novosCount,
      duplicadosEvitados: duplicadosCount,
      totalNaBaseCentral: cloudData.produtos.length,
      produtosCentral: cloudData.produtos,
      mensagem: `${novosCount} novo(s) serial(is) salvo(s) na base online com sucesso!`,
      timestamp: agora,
    });
  } catch (err: any) {
    console.error('Erro na API de sincronizacao:', err);
    return res.status(500).json({
      sucesso: false,
      erro: err.message || 'Erro interno ao processar sincronizacao.',
    });
  }
}
