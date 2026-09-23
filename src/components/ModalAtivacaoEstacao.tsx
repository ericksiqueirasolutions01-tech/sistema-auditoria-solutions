import React, { useState, useEffect } from 'react';
import { db } from '../db/storage';
import {
  ShieldCheck,
  Monitor,
  Wifi,
  WifiOff,
  CloudDownload,
  Database,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Building2,
  User,
  Lock,
} from 'lucide-react';
import { SolutionsLogo } from './SolutionsLogo';
import { SamsungLogo } from './SamsungLogo';

const REGIONAIS_HOMOLOGADAS = [
  'VIA VAREJO BA',
  'VIA VAREJO SP',
  'VIA VAREJO MG',
  'VIA VAREJO RJ',
] as const;

interface ModalAtivacaoEstacaoProps {
  onAtivado: () => void;
}

export const ModalAtivacaoEstacao: React.FC<ModalAtivacaoEstacaoProps> = ({ onAtivado }) => {
  const [online, setOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const compAtual = db.obterComputadorAtual();
  const [nomeMaquina, setNomeMaquina] = useState(compAtual.nome || compAtual.id || 'Estação 01');
  const [regional, setRegional] = useState(compAtual.regional || 'VIA VAREJO BA');
  const [usuarioResponsavel, setUsuarioResponsavel] = useState('Operador');
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<number>(0); // 0: Idle, 1: Conectando, 2: Baixando Usuários/Permissões, 3: Baixando Referências, 4: Ativando, 5: Concluído

  useEffect(() => {
    const handleOnlineStatus = () => {
      setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        setErro(null);
      }
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  const handleAtivar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!online) {
      setErro('Esta estação ainda não foi ativada. Conecte este computador à internet para realizar a sincronização inicial.');
      return;
    }

    setAtivando(true);
    setErro(null);
    setEtapa(1);

    try {
      setEtapa(2);
      await new Promise((r) => setTimeout(r, 600));

      setEtapa(3);
      const res = await db.ativarEstacao({
        nome_maquina: nomeMaquina.trim(),
        regional_vinculada: regional,
        usuario_responsavel: usuarioResponsavel.trim(),
      });

      if (res.sucesso) {
        setEtapa(4);
        await new Promise((r) => setTimeout(r, 500));
        setEtapa(5);
        setTimeout(() => {
          onAtivado();
        }, 1200);
      } else {
        setErro(res.mensagem || 'Falha ao ativar estação.');
        setEtapa(0);
      }
    } catch (err: any) {
      setErro(err?.message || 'Erro inesperado durante a ativação da estação.');
      setEtapa(0);
    } finally {
      setAtivando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 p-6 text-white text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <SolutionsLogo height={32} showText={false} />
            <div className="h-6 w-px bg-white/20" />
            <SamsungLogo height={16} variant="white" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-400/30 text-amber-300 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Camada de Ativação • Estação Windows
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight">
              Ativação de Estação de Trabalho
            </h2>
            <p className="text-xs text-blue-200 font-medium max-w-md mx-auto mt-1">
              Para habilitar a operação offline contínua nos galpões e clientes sem sinal de internet, esta estação precisa realizar a sincronização inicial obrigatória.
            </p>
          </div>
        </div>

        {/* Corpo */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Card de Status da Conexão */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between transition-colors ${
              online
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                : 'bg-rose-50/80 border-rose-300 text-rose-950'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  online ? 'bg-emerald-500 text-white shadow-xs' : 'bg-rose-500 text-white animate-pulse shadow-xs'
                }`}
              >
                {online ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider block opacity-75">
                  Conexão com a Internet
                </span>
                <span className="text-sm font-black uppercase">
                  {online ? 'Conectado — Pronto para Ativação' : 'Desconectado — Internet Necessária'}
                </span>
              </div>
            </div>

            {!online && (
              <button
                type="button"
                onClick={() => setOnline(typeof navigator !== 'undefined' ? navigator.onLine : false)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shrink-0"
              >
                Reverificar
              </button>
            )}
          </div>

          {/* Mensagem de Bloqueio se Offline */}
          {!online ? (
            <div className="p-5 bg-rose-50 border-2 border-rose-300 rounded-2xl text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-black text-rose-900 uppercase">
                  Esta estação ainda não foi ativada
                </h3>
                <p className="text-xs text-rose-700 font-medium leading-relaxed max-w-md mx-auto">
                  Conecte este computador à internet para realizar a sincronização inicial. Após ativada, a estação poderá operar normalmente 100% offline no galpão.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAtivar} className="space-y-4">
              {erro && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{erro}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    Nome da Máquina / Estação
                  </label>
                  <div className="relative">
                    <Monitor className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={nomeMaquina}
                      onChange={(e) => setNomeMaquina(e.target.value)}
                      disabled={ativando}
                      placeholder="Ex: Estação 01 - BA"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    Regional Vinculada
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={regional}
                      onChange={(e) => setRegional(e.target.value)}
                      disabled={ativando}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all cursor-pointer disabled:opacity-60"
                    >
                      {REGIONAIS_HOMOLOGADAS.map((r: string) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Usuário Responsável pela Ativação
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={usuarioResponsavel}
                    onChange={(e) => setUsuarioResponsavel(e.target.value)}
                    disabled={ativando}
                    placeholder="Nome do operador ou supervisor"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Checklist de Ativação durante o processamento */}
              {ativando && (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-blue-900">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Executando sincronização e ativação completa...</span>
                  </div>
                  <ul className="space-y-1 text-slate-600 pl-6 text-[11px]">
                    <li className={etapa >= 2 ? 'text-emerald-700 font-bold' : ''}>
                      ✓ Baixando usuários autorizados e permissões
                    </li>
                    <li className={etapa >= 3 ? 'text-emerald-700 font-bold' : ''}>
                      ✓ Carregando base de referência de IMEIs e lotes regionais
                    </li>
                    <li className={etapa >= 4 ? 'text-emerald-700 font-bold' : ''}>
                      ✓ Registrando dispositivo no banco central e emitindo credencial
                    </li>
                  </ul>
                </div>
              )}

              {etapa === 5 && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Estação ativada com sucesso! Liberando operação offline...</span>
                </div>
              )}

              <button
                type="submit"
                disabled={ativando || etapa === 5}
                className="w-full py-3.5 bg-blue-900 hover:bg-blue-800 active:scale-[0.99] disabled:opacity-60 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {ativando ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sincronizando e Ativando...</span>
                  </>
                ) : (
                  <>
                    <CloudDownload className="w-4 h-4" />
                    <span>Ativar Estação & Sincronizar Tudo</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Dica Operacional */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-[11px] text-slate-500 space-y-1">
            <span className="font-bold text-slate-700 block uppercase tracking-wider">
              Como funciona a ativação:
            </span>
            <p>
              Ao concluir a primeira sincronização com internet, todas as tabelas de referência de IMEIs da regional e os operadores credenciados são armazenados no armazenamento local protegido deste computador.
            </p>
            <p className="text-emerald-700 font-bold">
              No galpão do cliente sem sinal de rede, as bipagens continuarão funcionando em alta velocidade e com segurança absoluta.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
