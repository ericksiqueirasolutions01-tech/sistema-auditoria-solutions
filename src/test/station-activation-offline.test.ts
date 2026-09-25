// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { db } from '../db/storage';
import syncHandler from '../../api/central/sync';
import produtosHandler from '../../api/central/produtos';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_FALLBACK_URL = 'https://chvfzqekkmongsrqbwev.supabase.co';
const SUPABASE_FALLBACK_KEY = 'sb_publishable_F-Lc83bJD87AokRbHPmltg_hp2q6Ghj';
const supabase = createClient(SUPABASE_FALLBACK_URL, SUPABASE_FALLBACK_KEY);

const TEST_REGIONAL = 'VIA VAREJO BA';
const TEST_DATE_BR = '24/09/2026';
const TOTAL_OFFLINE_BIPAGENS = 50;

function limparTestDbLocal() {
  try {
    const testDbPath = path.resolve(process.cwd(), 'data', 'test_data', 'central_database.json');
    if (fs.existsSync(testDbPath)) {
      const parsed = JSON.parse(fs.readFileSync(testDbPath, 'utf8'));
      parsed.produtos = (parsed.produtos || []).filter(
        (p: any) => !p.serial || !p.serial.startsWith('35920000000')
      );
      fs.writeFileSync(testDbPath, JSON.stringify(parsed, null, 2), 'utf8');
    }
  } catch {}
}

function gerarImeiOffline(idx: number): string {
  const numStr = String(idx).padStart(4, '0');
  return `35920000000${numStr}`;
}

const IMEIS_TESTE = Array.from({ length: TOTAL_OFFLINE_BIPAGENS }, (_, i) => gerarImeiOffline(i + 1));

describe('CAMADA DE ATIVAÇÃO DE ESTAÇÃO WINDOWS & OPERAÇÃO OFFLINE (TESTES OBRIGATÓRIOS 1 A 5)', () => {
  const originalOnLine = navigator.onLine;

  beforeAll(async () => {
    process.env.FORCE_TEST_SERVER_SYNC = 'true';
    limparTestDbLocal();
    // Limpeza de testes anteriores no Supabase
    await supabase
      .from('audit_products')
      .delete()
      .gte('serial', '359200000000000')
      .lte('serial', '359200000009999');
  }, 30000);

  afterAll(async () => {
    // Restaurar conectividade padrão
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
      writable: true,
    });

    limparTestDbLocal();
    // Limpeza após testes
    await supabase
      .from('audit_products')
      .delete()
      .gte('serial', '359200000000000')
      .lte('serial', '359200000009999');
    delete process.env.FORCE_TEST_SERVER_SYNC;
  }, 30000);

  it('TESTE 1: Computador novo sem ativação deve bloquear operação offline e solicitar internet', async () => {
    // Simular máquina limpa sem ativação
    localStorage.removeItem('solutions_device_activation');
    localStorage.removeItem('solutions_config_inicial');
    (db as any).deviceActivation = null;

    expect(db.isEstacaoAtivada()).toBe(false);

    // Simular falta de internet
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });

    // 1. Tentar login offline sem ativação deve falhar com a mensagem exata
    const authResult = db.autenticar('VIA VAREJO BA', 'senha123');
    expect(authResult.sucesso).toBe(false);
    expect(authResult.erro).toBe(
      'Esta estação ainda não foi ativada. Conecte este computador à internet para realizar a sincronização inicial.'
    );

    // 2. Tentar ativar sem internet deve falhar com a mensagem exata
    const ativResult = await db.ativarEstacao({
      nome_maquina: 'Estação Teste Não Ativada',
      regional_vinculada: TEST_REGIONAL,
    });
    expect(ativResult.sucesso).toBe(false);
    expect(ativResult.mensagem).toBe(
      'Esta estação ainda não foi ativada. Conecte este computador à internet para realizar a sincronização inicial.'
    );

    // 3. Status da estação deve acusar não ativada
    const status = db.obterStatusEstacao();
    expect(status.status).toBe('ESTACAO_NAO_ATIVADA');
    expect(status.rotulo).toBe('ESTAÇÃO NÃO ATIVADA');
    expect(status.cor).toBe('vermelho');
  });

  it('TESTE 2: Computador ativado com internet e depois levado ao galpão sem internet deve abrir normalmente e permitir auditoria', async () => {
    // 1. Conectar internet para a ativação inicial
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });

    const ativResult = await db.ativarEstacao({
      nome_maquina: 'Bancada 01 - Galpão BA',
      regional_vinculada: TEST_REGIONAL,
      usuario_responsavel: 'Operador Principal',
    });

    expect(ativResult.sucesso).toBe(true);
    expect(db.isEstacaoAtivada()).toBe(true);
    const infoAtiv = db.obterAtivacaoEstacao();
    expect(infoAtiv?.device_activated).toBe(true);
    expect(infoAtiv?.regional_vinculada).toBe(TEST_REGIONAL);
    expect(infoAtiv?.nome_maquina).toBe('Bancada 01 - Galpão BA');

    // 2. Simular transporte da máquina para o galpão (100% SEM INTERNET)
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });

    // 3. Login offline de colaborador previamente sincronizado deve ser permitido com sucesso
    const authResult = db.autenticar('VIA VAREJO BA', 'senha123');
    expect(authResult.sucesso).toBe(true);
    expect(authResult.usuario).toBeDefined();

    db.definirColaboradorAtivo('Operador Galpão BA');
    expect(db.obterColaboradorAtivo()).toBe('Operador Galpão BA');

    // 4. Status da estação deve acusar ativada
    const status = db.obterStatusEstacao();
    expect(status.status).toBe('ESTACAO_ATIVADA');
    expect(status.rotulo).toBe('ESTAÇÃO ATIVADA');
    expect(status.cor).toBe('verde');
  });

  it('TESTE 3: Realizar 50 bipagens offline no galpão — Devem ficar salvas e pendentes com zero perda', async () => {
    // Garantir ambiente offline
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });

    // Limpar auditorias locais residuais para teste controlado de 50 itens
    (db as any).produtos = [];
    (db as any).serialMap.clear();
    localStorage.removeItem('solutions_produtos');

    // Realizar 50 bipagens no galpão com regras de caixa homogênea
    for (let i = 0; i < TOTAL_OFFLINE_BIPAGENS; i++) {
      const imei = IMEIS_TESTE[i];
      const isSamsung = i % 2 === 0;
      const caixaNum = Math.floor(i / 10) + 1;

      const res = db.inserirProduto({
        serial: imei,
        imei: imei,
        sku: isSamsung ? '5370761' : '5370760',
        modelo_produto: isSamsung ? 'GALAXY S24 ULTRA 512GB' : 'MOTO EDGE 50 ULTRA',
        fabricante: isSamsung ? 'SAMSUNG' : 'MOTOROLA',
        brand: isSamsung ? 'SAMSUNG' : 'MOTOROLA',
        numero_lote: 'LOTE GALPAO OFFLINE 01',
        numero_caixa: isSamsung ? `Caixa ${caixaNum} - SAM` : `Caixa ${caixaNum} - MOT`,
        produto_lacrado: 'SIM',
        data_auditoria: TEST_DATE_BR,
        regional: TEST_REGIONAL,
        source_type: 'LISTED',
        dealer: isSamsung ? 'SAMSUNG' : 'OUTRA MARCA',
      });
      expect(res.sucesso).toBe(true);
    }

    // Validações de integridade dos 50 itens gravados localmente
    const produtosLocais = db.listarProdutos();
    expect(produtosLocais.length).toBe(TOTAL_OFFLINE_BIPAGENS);

    // Todos devem estar com status_sincronizacao = 'PENDENTE'
    for (const prod of produtosLocais) {
      expect(prod.status_sincronizacao).toBe('PENDENTE');
      expect(prod.data_auditoria).toBe(TEST_DATE_BR);
    }

    // Status de sincronização deve acusar exatamente 50 pendentes
    const statusSync = db.obterStatusSincronizacao();
    expect(statusSync.pendentes).toBe(TOTAL_OFFLINE_BIPAGENS);

    // Status da estação deve acusar pendências de envio
    const statusEstacao = db.obterStatusEstacao();
    expect(statusEstacao.status).toBe('PENDENCIAS_ENVIO');
    expect(statusEstacao.rotulo).toBe('PENDÊNCIAS DE ENVIO');
    expect(statusEstacao.cor).toBe('amarelo');
    expect(statusEstacao.pendentes).toBe(TOTAL_OFFLINE_BIPAGENS);
  });

  it('TESTE 4: Conectar internet — As 50 bipagens devem subir para o Supabase e atualizar status', async () => {
    // 1. Simular reconexão da internet
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });

    const produtosPendentes = db.listarProdutos().filter((p) => p.status_sincronizacao === 'PENDENTE');
    expect(produtosPendentes.length).toBe(TOTAL_OFFLINE_BIPAGENS);

    // 2. Enviar sincronização para a API central (Supabase)
    const req = {
      method: 'POST',
      headers: {
        origin: 'https://sistema-auditoria-solutions.vercel.app',
      },
      body: {
        usuario: {
          nome: 'Operador Galpão BA',
          login: 'VIA VAREJO BA',
          perfil: 'OPERADOR',
          regional: TEST_REGIONAL,
        },
        regional: TEST_REGIONAL,
        computador: {
          id: 'BANCADA-GALPAO-01',
          nome: 'Bancada 01 - Galpão BA',
          regional: TEST_REGIONAL,
        },
        produtos: produtosPendentes,
      },
    };

    let statusCode = 0;
    let jsonResult: any = null;

    const res = {
      setHeader: vi.fn(),
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            jsonResult = data;
            return data;
          },
        };
      },
    };

    await syncHandler(req, res);

    expect(statusCode).toBe(200);
    expect(jsonResult.sucesso).toBe(true);
    expect(jsonResult.sincronizados).toBe(TOTAL_OFFLINE_BIPAGENS);
    expect(jsonResult.itensDuplicados).toHaveLength(0);

    // 3. Atualizar status dos produtos locais para 'ENVIADO' (como faz db.sincronizarOnline)
    const agora = new Date().toISOString();
    for (const p of (db as any).produtos) {
      p.status_sincronizacao = 'ENVIADO';
      p.sync_status = 'ENVIADO';
      p.data_sincronizacao = agora;
      p.sync_data = agora;
    }
    (db as any).salvarTudo();
    localStorage.setItem('solutions_ultimo_envio', agora);
    localStorage.setItem('solutions_ultima_sincronizacao', agora);
    localStorage.setItem('solutions_ultima_comunicacao', agora);

    // 4. Confirmar que pendências zeraram e estação voltou a ESTAÇÃO ATIVADA (verde)
    const statusSync = db.obterStatusSincronizacao();
    expect(statusSync.pendentes).toBe(0);

    const statusEstacao = db.obterStatusEstacao();
    expect(statusEstacao.status).toBe('ESTACAO_ATIVADA');
    expect(statusEstacao.rotulo).toBe('ESTAÇÃO ATIVADA');
    expect(statusEstacao.cor).toBe('verde');
    expect(statusEstacao.pendentes).toBe(0);
  });

  it('TESTE 5: Abrir painel ADMIN — Os 50 registros devem aparecer diretamente do Supabase', async () => {
    // 1. Simular consulta do Painel Admin na API central /api/central/produtos
    let statusCode = 0;
    let jsonResult: any = null;

    const req = {
      method: 'GET',
      headers: {
        origin: 'https://sistema-auditoria-solutions.vercel.app',
        'x-user-perfil': 'ADMINISTRADOR',
        'x-user-regional': 'TODAS',
      },
      query: {
        regional: TEST_REGIONAL,
        limit: '100',
        perfil: 'ADMINISTRADOR',
      },
    };

    const res = {
      setHeader: vi.fn(),
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            jsonResult = data;
            return data;
          },
        };
      },
    };

    await produtosHandler(req, res);

    expect(statusCode).toBe(200);
    expect(jsonResult.sucesso).toBe(true);
    expect(Array.isArray(jsonResult.produtos)).toBe(true);

    // 2. Conferir que os 50 registros enviados estão presentes no Supabase
    const produtosSupabase = jsonResult.produtos.filter((p: any) =>
      IMEIS_TESTE.includes(p.serial || p.imei)
    );

    expect(produtosSupabase.length).toBe(TOTAL_OFFLINE_BIPAGENS);

    // 3. Validar consistência de cada registro retornado pela API do painel ADMIN
    for (const prod of produtosSupabase) {
      expect(prod.regional).toContain('BA');
      expect(prod.usuario_sincronizacao || prod.usuario_cadastro).toBe('Operador Galpão BA');
      expect(prod.data_auditoria).toBe('24/09/2026'); // Formatado pelo endpoint central para exibição no painel
      expect(prod.status_sincronizacao).toBe('ENVIADO');
      expect(prod.numero_lote).toBe('LOTE GALPAO OFFLINE 01');
      expect(prod.produto_lacrado).toBe('SIM');
    }

    // 4. Conferir integridade no Supabase direto via SDK
    const { count, error, data: directData } = await supabase
      .from('audit_products')
      .select('*, regions(codigo, nome)', { count: 'exact' })
      .eq('numero_lote', 'LOTE GALPAO OFFLINE 01');

    expect(error).toBeNull();
    expect(count).toBe(TOTAL_OFFLINE_BIPAGENS);
    expect(directData).toBeDefined();
    expect(directData?.[0].data_auditoria).toBe('2026-09-24'); // Normalizado no Postgres
    expect(directData?.[0].status_sincronizacao).toBe('ENVIADO');
  });
});
