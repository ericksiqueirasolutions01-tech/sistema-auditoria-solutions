import React, { useState } from 'react';
import { db } from '../db/storage';
import { Usuario, PerfilUsuario } from '../types';
import {
  Users,
  ShieldCheck,
  History,
  UserPlus,
  Lock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const GestaoUsuarios: React.FC = () => {
  const usuarioLogado = db.getUsuarioAtual();
  const isAdmin = usuarioLogado?.perfil === 'ADMINISTRADOR';

  const [usuarios, setUsuarios] = useState(() => db.listarUsuarios());
  const [historico, setHistorico] = useState(() => db.listarHistorico(100));

  // Form New User
  const [nome, setNome] = useState('');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState<PerfilUsuario>('OPERADOR');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const handleCriarUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!nome.trim() || !login.trim() || !senha.trim()) {
      setMsg({ tipo: 'erro', texto: 'Preencha todos os campos obrigatórios.' });
      return;
    }

    const res = db.salvarUsuario({
      nome: nome.trim(),
      login: login.trim().toLowerCase(),
      senha: senha.trim(),
      perfil,
    });

    if (res.sucesso) {
      setMsg({ tipo: 'ok', texto: `Usuário ${nome} criado com sucesso!` });
      setNome('');
      setLogin('');
      setSenha('');
      setUsuarios(db.listarUsuarios());
      setHistorico(db.listarHistorico(100));
    } else {
      setMsg({ tipo: 'erro', texto: res.erro || 'Falha ao criar usuário.' });
    }
  };

  const handleToggleAtivo = (u: Usuario) => {
    if (!isAdmin) return;
    if (u.id === usuarioLogado?.id) {
      alert('Você não pode desativar seu próprio usuário.');
      return;
    }
    db.salvarUsuario({
      ...u,
      ativo: !u.ativo,
    });
    setUsuarios(db.listarUsuarios());
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* User Management Section (Admin Only) */}
      {isAdmin && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
              <Users className="w-6 h-6 text-purple-600" />
              Gestão de Usuários e Permissões
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Cadastre operadores de bipagem e administradores do sistema
            </p>
          </div>

          {msg && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                msg.tipo === 'ok'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-rose-50 border-rose-300 text-rose-800'
              }`}
            >
              {msg.tipo === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
              <span>{msg.texto}</span>
            </div>
          )}

          {/* Form to create new user */}
          <form
            onSubmit={handleCriarUsuario}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200"
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Login / Usuário
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Ex: joao.silva"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Senha de Acesso
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Perfil de Acesso
              </label>
              <select
                value={perfil}
                onChange={(e) => setPerfil(e.target.value as PerfilUsuario)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500"
              >
                <option value="OPERADOR">OPERADOR (Bipagem/Espelhos)</option>
                <option value="ADMINISTRADOR">ADMINISTRADOR (Total)</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase px-4 py-2.5 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Cadastrar
              </button>
            </div>
          </form>

          {/* User List Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white font-black uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">Login</th>
                  <th className="py-3 px-4">Perfil</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-bold text-slate-800">{u.nome}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{u.login}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          u.perfil === 'ADMINISTRADOR'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {u.perfil}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleAtivo(u)}
                        disabled={u.id === usuarioLogado?.id}
                        className="text-xs font-bold text-slate-600 hover:text-blue-600 disabled:opacity-30"
                      >
                        {u.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History / Audit Log (Requisito 21) */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
              <History className="w-5 h-5 text-blue-600" />
              Histórico de Ações e Rastreabilidade
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Log detalhado de todas as operações, cadastros e alterações efetuadas
            </p>
          </div>
          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-lg">
            {historico.length} registros recentes
          </span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] sticky top-0 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Usuário</th>
                <th className="py-2.5 px-3">Ação</th>
                <th className="py-2.5 px-4">Detalhes da Operação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {historico.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 font-sans font-medium">
                    Nenhum registro de log no momento.
                  </td>
                </tr>
              ) : (
                historico.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{h.data_hora}</td>
                    <td className="py-2 px-3 font-bold text-slate-800">{h.usuario}</td>
                    <td className="py-2 px-3">
                      <span className="bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {h.acao}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-slate-700 font-sans">{h.detalhes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

