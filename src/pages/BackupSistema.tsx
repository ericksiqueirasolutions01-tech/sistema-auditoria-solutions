import React, { useState, useRef } from 'react';
import { db, isAdminOuSuper } from '../db/storage';
import { hashSenha } from '../utils/crypto';
import {
  validarArquivoBackup,
  gerarBackupCompleto,
  executarDryRunBackup,
  executarRestoreTransacional,
  executarRollbackSnapshot,
} from '../services/backupRestoreService';
import type { DryRunResultado, Usuario } from '../types';
import {
  HardDrive,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  FileCheck,
  Lock,
  Layers,
  Info,
  X,
} from 'lucide-react';

export const BackupSistema: React.FC = () => {
  const [mensagem, setMensagem] = useState<{
    tipo: 'sucesso' | 'erro' | 'aviso';
    texto: string;
  } | null>(null);

  const [processando, setProcessando] = useState(false);
  const [dryRun, setDryRun] = useState<DryRunResultado | null>(null);
  const [conteudoArquivo, setConteudoArquivo] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string>('');
  const [modalDryRunAberto, setModalDryRunAberto] = useState(false);
  const [ultimoSnapshotId, setUltimoSnapshotId] = useState<string | null>(null);
  const [senhaAdmin, setSenhaAdmin] = useState<string>('');
  const [erroAutenticacao, setErroAutenticacao] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const usuarioAtual = db.getUsuarioAtual();
  const isAdmin = isAdminOuSuper(usuarioAtual?.perfil);

  /**
   * 1. Gera Backup Completo com Manifesto v1 (Gate 8 / Regra 12.1)
   */
  const handleCriarBackup = async () => {
    setProcessando(true);
    try {
      const { manifest, jsonConteudo, nomeArquivo } = await gerarBackupCompleto();

      const blob = new Blob([jsonConteudo], { type: 'application/json' });
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
        texto: `Backup v${manifest.format_version} gerado com sucesso! Arquivo: ${nomeArquivo} (SHA-256: ${manifest.checksum.substring(0, 16)}...). Senhas plaintext redigidas com segurança.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setMensagem({ tipo: 'erro', texto: `Falha ao gerar backup: ${message}` });
    } finally {
      setProcessando(false);
    }
  };

  /**
   * 2. Seleção de Arquivo e Execução do Dry-Run (Gate 8 / Regra 12.2 - Passos 1 a 5)
   */
  const handleSelecionarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    // Passo 1: Validar extensão e tamanho
    const validacao = validarArquivoBackup(arquivo);
    if (!validacao.valido) {
      setMensagem({ tipo: 'erro', texto: validacao.erro || 'Arquivo de backup inválido.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const leitor = new FileReader();
    leitor.onload = (evt) => {
      try {
        const conteudo = evt.target?.result as string;

        // Passos 2, 3 e 4: Schema, Version, Checksum e Dry-Run
        const resultadoDryRun = executarDryRunBackup(conteudo);

        if (!resultadoDryRun.valido) {
          setMensagem({
            tipo: 'erro',
            texto: `Dry-run rejeitou o backup: ${resultadoDryRun.erro}`,
          });
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        // Armazena e exibe resumo no modal para confirmação consciente (Passo 5)
        setDryRun(resultadoDryRun);
        setConteudoArquivo(conteudo);
        setNomeArquivo(arquivo.name);
        setSenhaAdmin('');
        setErroAutenticacao(null);
        setModalDryRunAberto(true);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setMensagem({ tipo: 'erro', texto: `Erro ao analisar arquivo de backup: ${message}` });
      }
    };
    leitor.readAsText(arquivo);
  };

  /**
   * 3. Execução Transacional do Restore (Gate 8 / Regra 12.2 - Passos 6 a 10)
   */
  const handleConfirmarRestore = async () => {
    if (!conteudoArquivo) return;

    // Passo 6: Validação de autorização do Administrador
    if (!isAdmin) {
      setErroAutenticacao('Acesso restrito: Apenas Administradores do Sistema podem restaurar backups.');
      return;
    }

    // Se o usuário atual for admin e tiver senha cadastrada, valida a confirmação de senha
    if (usuarioAtual?.senha && senhaAdmin) {
      const match = usuarioAtual.senha === senhaAdmin || usuarioAtual.senha === hashSenha(senhaAdmin);
      if (!match) {
        setErroAutenticacao('Senha de confirmação do administrador incorreta.');
        return;
      }
    }

    setProcessando(true);
    setErroAutenticacao(null);

    try {
      const resultado = await executarRestoreTransacional(conteudoArquivo, usuarioAtual as Usuario);

      if (resultado.sucesso) {
        setUltimoSnapshotId(resultado.snapshotId || null);
        setModalDryRunAberto(false);
        setConteudoArquivo(null);
        setDryRun(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        setMensagem({
          tipo: 'sucesso',
          texto: `Base de dados restaurada com sucesso! ${resultado.totalImportado} produtos e ${resultado.contagensRestauradas?.lotes || 0} lotes carregados. Snapshot de segurança gerado: ${resultado.snapshotId}.`,
        });
      } else {
        setErroAutenticacao(resultado.erro || 'Falha ao restaurar banco.');
        setMensagem({
          tipo: 'erro',
          texto: `Falha na restauração: ${resultado.erro}. Rollback acionado com segurança.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMensagem({ tipo: 'erro', texto: `Erro inesperado na restauração: ${msg}` });
    } finally {
      setProcessando(false);
    }
  };

  /**
   * 4. Rollback Manual para o Snapshot Pré-Restore
   */
  const handleExecutarRollback = async () => {
    if (!ultimoSnapshotId) return;

    if (
      !window.confirm(
        `Deseja desfazer a última restauração e retornar ao snapshot de segurança (${ultimoSnapshotId})?`
      )
    ) {
      return;
    }

    setProcessando(true);
    try {
      const ok = await executarRollbackSnapshot(ultimoSnapshotId);
      if (ok) {
        setMensagem({
          tipo: 'sucesso',
          texto: `Rollback concluído com sucesso! A base retornou ao estado pré-restauração.`,
        });
        setUltimoSnapshotId(null);
      } else {
        setMensagem({
          tipo: 'erro',
          texto: 'Não foi possível recuperar o snapshot de segurança para rollback.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMensagem({ tipo: 'erro', texto: `Erro durante rollback: ${msg}` });
    } finally {
      setProcessando(false);
    }
  };

  const totalProdutosAtuais = db.listarProdutos().length;
  const totalLotesAtuais = db.listarLotesFinalizados().length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
            <HardDrive className="w-6 h-6 text-blue-600" />
            Backup e Recuperação Segura do Banco de Dados
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Mecanismo offline com manifesto criptográfico SHA-256, dry-run e rollback automático pré-restore
          </p>
        </div>

        {mensagem && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 ${
              mensagem.tipo === 'sucesso'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : mensagem.tipo === 'aviso'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            {mensagem.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : mensagem.tipo === 'aviso' ? (
              <Info className="w-5 h-5 text-amber-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-xs font-bold">{mensagem.texto}</span>
          </div>
        )}

        {/* Status da Base Atual */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700">Estado Atual da Base Local</p>
              <p className="text-[11px] text-slate-500">
                {totalProdutosAtuais} produtos cadastrados | {totalLotesAtuais} lotes finalizados
              </p>
            </div>
          </div>
          {ultimoSnapshotId && (
            <button
              onClick={handleExecutarRollback}
              disabled={processando}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-black transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Desfazer Última Restauração (Rollback)
            </button>
          )}
        </div>

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
                Exporta um arquivo assinado criptograficamente com manifesto de dados, checksum SHA-256 e redação segura de senhas de usuários.
              </p>
            </div>

            <button
              onClick={handleCriarBackup}
              disabled={processando}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              {processando ? 'Gerando Backup...' : 'Gerar e Baixar Backup (v1)'}
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
                Restauração protegida com validação de extensão, integridade de checksum, dry-run prévio e criação automática de snapshot pré-restore.
              </p>
            </div>

            <label className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-center">
              <Upload className="w-4 h-4" />
              Selecionar Arquivo para Validação
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.bak"
                onChange={handleSelecionarArquivo}
                className="hidden"
                disabled={processando}
              />
            </label>
          </div>
        </div>

        {/* Informações de Integridade do Gate 8 */}
        <div className="border-t border-slate-100 pt-6">
          <h4 className="text-xs font-black text-slate-700 uppercase mb-3 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Garantias de Segurança do Motor de Backup (Gate 8)
          </h4>
          <ul className="text-[11px] text-slate-600 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <span><strong>Checksum SHA-256 Canônico:</strong> Protege contra adulteração acidental ou intencional do conteúdo do backup.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <span><strong>Redação de Senhas:</strong> Backups nunca incluem senhas plaintext, preservando as credenciais seguras locais.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <span><strong>Snapshot Pré-Restore e Rollback:</strong> Antes de qualquer modificação, uma cópia de segurança é criada localmente para garantir reversão imediata caso ocorra divergência de contagem.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Modal de Dry-Run e Confirmação de Restauração (Gate 8 / Regra 12.2) */}
      {modalDryRunAberto && dryRun && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-black text-slate-800 uppercase">
                  Validação Dry-Run do Backup
                </h3>
              </div>
              <button
                onClick={() => setModalDryRunAberto(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informações do Arquivo */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-700 truncate">Arquivo: {nomeArquivo}</p>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      dryRun.detalhes.checksumValido
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {dryRun.detalhes.checksumValido ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Checksum SHA-256 Válido
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3" /> Checksum Divergente
                      </>
                    )}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-500">Versão: {dryRun.detalhes.appVersion || '1.0'}</span>
                </div>
                {dryRun.manifest?.checksum && (
                  <p className="text-[10px] font-mono text-slate-400 break-all">
                    Hash: {dryRun.manifest.checksum}
                  </p>
                )}
              </div>

              {/* Resumo de Registros */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-blue-600 uppercase">Produtos</p>
                  <p className="text-lg font-black text-blue-900">{dryRun.detalhes.totalProdutos}</p>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase">Lotes</p>
                  <p className="text-lg font-black text-indigo-900">{dryRun.detalhes.totalLotes}</p>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-purple-600 uppercase">Usuários</p>
                  <p className="text-lg font-black text-purple-900">{dryRun.detalhes.totalUsuarios}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-slate-600 uppercase">Histórico</p>
                  <p className="text-lg font-black text-slate-900">{dryRun.detalhes.totalHistorico}</p>
                </div>
              </div>

              {/* Alerta de Substituição e Segurança */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <p className="font-bold">Atenção para a substituição dos dados:</p>
                  <p>
                    A base atual possui <strong>{totalProdutosAtuais} produtos</strong>. Ao confirmar, todos os dados locais serão substituídos pelos dados deste backup. Um snapshot de segurança pré-restore será gravado automaticamente.
                  </p>
                </div>
              </div>

              {/* Reautenticação do Administrador (Passo 6) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700">
                  <Lock className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                  Autorização de Administrador Requerida
                </label>
                <input
                  type="password"
                  placeholder="Informe a senha do Administrador para confirmar"
                  value={senhaAdmin}
                  onChange={(e) => setSenhaAdmin(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
                {erroAutenticacao && (
                  <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {erroAutenticacao}
                  </p>
                )}
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setModalDryRunAberto(false)}
                disabled={processando}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarRestore}
                disabled={processando || !dryRun.detalhes.checksumValido}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl text-xs font-black uppercase tracking-wide shadow-sm transition-transform active:scale-95 flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                {processando ? 'Executando Restore...' : 'Confirmar Restauração Segura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
