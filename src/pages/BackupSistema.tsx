import React, { useState } from 'react';
import { db } from '../db/storage';
import {
  HardDrive,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

export const BackupSistema: React.FC = () => {
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(
    null
  );

  const criarBackup = () => {
    try {
      const conteudo = db.gerarArquivoBackup();
      const agora = new Date().toISOString().replace(/[:.]/g, '-');
      const nomeArquivo = `backup_auditoria_solutions_${agora}.json`;

      const blob = new Blob([conteudo], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMensagem({
        tipo: 'sucesso',
        texto: `Backup gerado e baixado com sucesso! Arquivo: ${nomeArquivo}`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setMensagem({ tipo: 'erro', texto: `Falha ao gerar backup: ${message}` });
    }
  };

  const restaurarBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    if (
      !window.confirm(
        'Atenção: A restauração substituirá todos os registros locais existentes pelos dados do backup. Deseja continuar?'
      )
    ) {
      e.target.value = '';
      return;
    }

    const leitor = new FileReader();
    leitor.onload = (evt) => {
      try {
        const conteudo = evt.target?.result as string;
        const res = db.restaurarDeBackup(conteudo);
        if (res.sucesso) {
          setMensagem({
            tipo: 'sucesso',
            texto: `Base restaurada com sucesso! Total de ${res.totalImportado} produtos carregados.`,
          });
        } else {
          setMensagem({ tipo: 'erro', texto: res.erro || 'Falha ao restaurar backup.' });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setMensagem({ tipo: 'erro', texto: `Erro ao processar arquivo: ${message}` });
      }
    };
    leitor.readAsText(arquivo);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
            <HardDrive className="w-6 h-6 text-blue-600" />
            Backup e Recuperação do Banco de Dados
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Mecanismo de segurança 100% offline para preservação dos dados auditados
          </p>
        </div>

        {mensagem && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 ${
              mensagem.tipo === 'sucesso'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            {mensagem.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-xs font-bold">{mensagem.texto}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Criar Backup */}
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-800 uppercase">
                Criar Backup Completo
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Exporta instantaneamente uma cópia de segurança de todos os produtos auditados,
                usuários e histórico de operações para um arquivo local.
              </p>
            </div>

            <button
              onClick={criarBackup}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Gerar e Salvar Backup
            </button>
          </div>

          {/* Card 2: Restaurar Backup */}
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-800 uppercase">
                Restaurar Base de Dados
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Selecione um arquivo de backup previamente gerado pelo sistema para recuperar
                todos os dados de auditoria nesta máquina.
              </p>
            </div>

            <label className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-center">
              <Upload className="w-4 h-4" />
              Selecionar Arquivo para Restaurar
              <input
                type="file"
                accept=".json,.db"
                onChange={restaurarBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Ambientes de Teste / Demonstração */}
        <div className="border-t border-slate-100 pt-6">
          <h4 className="text-xs font-black text-slate-700 uppercase mb-3">
            Ferramentas de Demonstração & Manutenção
          </h4>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                if (window.confirm('Deseja carregar 15 produtos de demonstração para testar gráficos e espelhos?')) {
                  const exemplos = [
                    { modelo: 'Galaxy A55 5G', ean: '7892509134125', serial: 'R5CW101ABCD', caixa: 'CAIXA 01', lacrado: 'SIM' },
                    { modelo: 'Galaxy A55 5G', ean: '7892509134125', serial: 'R5CW102EFGH', caixa: 'CAIXA 01', lacrado: 'SIM' },
                    { modelo: 'Galaxy A55 5G', ean: '7892509134125', serial: 'R5CW103IJKL', caixa: 'CAIXA 01', lacrado: 'SIM' },
                    { modelo: 'Galaxy A55 5G', ean: '7892509134125', serial: 'R5CW104MNOP', caixa: 'CAIXA 01', lacrado: 'NÃO' },
                    { modelo: 'Galaxy S24 Ultra', ean: '7892509133456', serial: 'R5CW201QRST', caixa: 'CAIXA 01', lacrado: 'SIM' },
                    { modelo: 'Galaxy S24 Ultra', ean: '7892509133456', serial: 'R5CW202UVWX', caixa: 'CAIXA 02', lacrado: 'SIM' },
                    { modelo: 'Galaxy S24 Ultra', ean: '7892509133456', serial: 'R5CW203YZ12', caixa: 'CAIXA 02', lacrado: 'SIM' },
                    { modelo: 'Galaxy S24+', ean: '7892509133463', serial: 'R5CW3013456', caixa: 'CAIXA 02', lacrado: 'NÃO' },
                    { modelo: 'Galaxy Tab S9 FE', ean: '7892509131452', serial: 'R5CW4017890', caixa: 'CAIXA 03', lacrado: 'SIM' },
                    { modelo: 'Galaxy Tab S9 FE', ean: '7892509131452', serial: 'R5CW402AB12', caixa: 'CAIXA 03', lacrado: 'SIM' },
                  ];
                  db.importarPlanilha(exemplos);
                  setMensagem({ tipo: 'sucesso', texto: '10 produtos de exemplo carregados com sucesso!' });
                }
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Carregar Dados de Exemplo (10 produtos)
            </button>

            <button
              onClick={() => {
                if (window.confirm('Atenção: Deseja apagar todos os produtos auditados e zerar o banco? Esta ação é irreversível.')) {
                  localStorage.removeItem('solutions_auditoria_produtos_v1');
                  window.location.reload();
                }
              }}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors"
            >
              Zerar Produtos do Banco de Dados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
