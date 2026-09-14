const CLOUD_STORAGE_URL = 'https://extendsclass.com/api/json-storage/bin/dcccfea';
const CLOUD_STORAGE_BACKUP_URL = 'https://extendsclass.com/api/json-storage/bin/ffedcbb';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

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
    const { produtos, computador, usuario, regional, fotos } = body || {};
    if ((!Array.isArray(produtos) || produtos.length === 0) && (!Array.isArray(fotos) || fotos.length === 0)) {
      return res.status(400).json({ erro: 'Nenhum produto ou foto enviado para sincronizacao.' });
    }

    let cloudData: { system?: string; produtos: any[]; fotos?: any[]; historico_envios: any[]; ultimaAtualizacao?: string } = {
      system: 'GRUPO SOLUTIONS AUDITORIA SAMSUNG',
      produtos: [],
      fotos: [],
      historico_envios: [],
    };

    try {
      let getRes = await fetch(`${CLOUD_STORAGE_URL}?_t=${Date.now()}`);
      if (!getRes.ok) {
        getRes = await fetch(`${CLOUD_STORAGE_BACKUP_URL}?_t=${Date.now()}`);
      }
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
    const duplicadosList: any[] = [];

    const mapExistentes = new Map<string, any>();
    if (Array.isArray(cloudData.produtos)) {
      for (const p of cloudData.produtos) {
        const sn = (p.serial || '').trim().toUpperCase();
        if (sn) {
          mapExistentes.set(sn, p);
        }
      }
    } else {
      cloudData.produtos = [];
    }

    if (Array.isArray(produtos)) {
      for (const p of produtos) {
        const sn = (p.serial || '').trim().toUpperCase();
        if (!sn) continue;

        if (mapExistentes.has(sn)) {
          const existente = mapExistentes.get(sn);
          duplicadosList.push({
            imei: p.serial,
            serial: p.serial,
            modelo_produto: p.modelo_produto || existente.modelo_produto || '',
            numero_caixa: p.numero_caixa || existente.numero_caixa || '',
            data_cadastro_existente:
              existente.data_cadastro ||
              existente.data_auditoria ||
              existente.data_sincronizacao ||
              'Data anterior não informada',
            usuario_existente:
              existente.usuario_cadastro ||
              existente.usuario_criacao ||
              existente.usuario ||
              'Outro Colaborador',
            computador_existente:
              existente.computador_nome ||
              existente.computador_id ||
              'Outra Estação',
            regional_existente: existente.regional || 'Geral',
            status: 'DUPLICADO NO SERVIDOR',
            id_local: p.id,
          });
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
          mapExistentes.set(sn, itemNormalizado);
          novosCount++;
        }
      }
    }

    let fotosCount = 0;
    if (Array.isArray(fotos) && fotos.length > 0) {
      if (!Array.isArray(cloudData.fotos)) {
        cloudData.fotos = [];
      }
      const mapFotos = new Map<string, any>();
      for (const f of cloudData.fotos) {
        if (f && f.id) mapFotos.set(f.id, f);
      }
      for (const f of fotos) {
        if (f && f.id) {
          if (!mapFotos.has(f.id)) fotosCount++;
          // Manter fotos leves para nuvem central (se for base64 pesado, salvar preview compacto)
          let uri = f.fotoDataUri;
          if (uri && uri.startsWith('data:image') && uri.length > 2000) {
            uri = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90" viewBox="0 0 120 90"><rect width="120" height="90" fill="%230F172A"/><text x="60" y="45" fill="%2338BDF8" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle" dominant-baseline="middle">FOTO REGISTRADA</text></svg>';
          }
          mapFotos.set(f.id, { ...f, fotoDataUri: uri, status_sincronizacao: 'ENVIADO' });
        }
      }
      cloudData.fotos = Array.from(mapFotos.values());
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
      detalhes: `${novosCount} novos seriais e ${fotosCount} fotos sincronizados na nuvem central (${duplicadosList.length} duplicados evitados).`,
      timestamp: agora,
    };

    if (!Array.isArray(cloudData.historico_envios)) {
      cloudData.historico_envios = [];
    }
    cloudData.historico_envios.unshift(logEnvio);
    if (cloudData.historico_envios.length > 200) {
      cloudData.historico_envios = cloudData.historico_envios.slice(0, 200);
    }

    cloudData.ultimaAtualizacao = agora;

    // Salva no storage principal e espelha no backup
    const bodyStr = JSON.stringify(cloudData);
    let putRes = await fetch(CLOUD_STORAGE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
    });

    if (!putRes.ok) {
      console.warn('PUT principal falhou, tentando backup...');
      putRes = await fetch(CLOUD_STORAGE_BACKUP_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
      });
    }

    return res.status(200).json({
      sucesso: true,
      sincronizados: novosCount,
      fotosSincronizadas: fotosCount,
      duplicadosEvitados: duplicadosList.length,
      itensDuplicados: duplicadosList,
      totalNaBaseCentral: cloudData.produtos.length,
      produtosCentral: cloudData.produtos,
      fotosCentral: cloudData.fotos,
      mensagem:
        duplicadosList.length > 0
          ? `${novosCount} novo(s) serial(is) sincronizado(s). ${duplicadosList.length} IMEI(s) não foram enviados pois já constam no servidor.`
          : `${novosCount} novo(s) serial(is) e ${fotosCount} foto(s) sincronizado(s) online com sucesso!`,
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
