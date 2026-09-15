import React from 'react';
import { Download, Monitor, CheckCircle2, ShieldCheck, X, HardDrive, Cpu, Calendar, Tag, FileText } from 'lucide-react';
import { SolutionsLogo } from './SolutionsLogo';
import { SamsungLogo } from './SamsungLogo';

interface ModalDownloadAppProps {
  onClose: () => void;
}

export const ModalDownloadApp: React.FC<ModalDownloadAppProps> = ({ onClose }) => {
  const versaoApp = '1.2.0';
  const dataAtualizacao = '15/09/2026';
  const nomeApp = 'Sistema de Auditoria Grupo Solutions - Samsung';
  const downloadUrl = '/downloads/Sistema-Auditoria-Solutions-Setup.exe';
  const manualPdfUrl = '/downloads/Manual_Colaborador_Auditoria_Solutions.pdf';

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', 'Sistema-Auditoria-Solutions-Setup.exe');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadManual = () => {
    const link = document.createElement('a');
    link.href = manualPdfUrl;
    link.setAttribute('download', 'Manual_Colaborador_Auditoria_Solutions.pdf');
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <SolutionsLogo height={32} showText={false} />
            <div className="h-6 w-px bg-white/20" />
            <SamsungLogo height={16} variant="white" />
          </div>

          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-blue-500/20 border border-blue-400/30 rounded-xl">
              <Monitor className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-tight">
                Baixar Aplicativo Windows
              </h3>
              <p className="text-xs text-blue-200 font-medium">
                Instalação profissional para computadores corporativos
              </p>
            </div>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-5">
          {/* Card de Informações da Versão */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                Programa:
              </span>
              <span className="font-black text-slate-900 text-right">{nomeApp}</span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-slate-200/60 pt-2">
              <span className="font-bold text-slate-500 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                Versão:
              </span>
              <span className="font-mono font-black text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                v{versaoApp}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-slate-200/60 pt-2">
              <span className="font-bold text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Última Atualização:
              </span>
              <span className="font-bold text-slate-700">{dataAtualizacao}</span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-slate-200/60 pt-2">
              <span className="font-bold text-slate-500 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-600" />
                Compatibilidade:
              </span>
              <span className="font-bold text-slate-700">Windows 10 e Windows 11 (64-bit)</span>
            </div>
          </div>

          {/* Destaques do Instalador */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Recursos do Aplicativo Instalado:
            </h4>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex items-start gap-2 bg-emerald-50/70 border border-emerald-200 p-2.5 rounded-xl text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Operação 100% Offline:</strong> Trabalhe continuamente mesmo sem conexão com a internet após a primeira sincronização.
                </div>
              </div>
              <div className="flex items-start gap-2 bg-blue-50/70 border border-blue-200 p-2.5 rounded-xl text-blue-900">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Atalhos no Windows:</strong> Ícone na Área de Trabalho e no Menu Iniciar para acesso direto com 1 clique.
                </div>
              </div>
              <div className="flex items-start gap-2 bg-purple-50/70 border border-purple-200 p-2.5 rounded-xl text-purple-900">
                <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Janela Própria de Alta Performance:</strong> Não depende de abrir navegador nem mantém barras indesejadas.
                </div>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={handleDownload}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Instalador Windows (.EXE)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadManual}
              className="w-full bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 border border-slate-300 py-3 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>📄 Baixar Manual do Colaborador (PDF)</span>
            </button>

            <p className="text-[10px] text-center text-slate-400 mt-2">
              Instalador direto e Guia Passo a Passo Oficial para treinamento da equipe.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

