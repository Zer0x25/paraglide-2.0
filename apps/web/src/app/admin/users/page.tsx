'use client';

import { PlusCircle, Pencil, Trash2, KeyRound, Search, AlertCircle, Mail, Calendar } from 'lucide-react';
import { Button, Spinner, inputClass } from '@/components/ui';
import { OfflinePageGuard } from '@/components/OfflinePageGuard';
import { useAdminUsersController, type RoleFilter } from './hooks/useAdminUsersController';
import { UserFormModal } from './components/UserFormModal';
import { UserPasswordModal } from './components/UserPasswordModal';

export default function AdminUsersPage() {
  const c = useAdminUsersController();

  // Gate admin: solo bloquear cuando user ya cargó y no es admin
  if (c.me && c.me.role !== 'ADMIN') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-amber-600 mt-0.5" />
          <div>
            <h2 className="font-bold text-amber-800">Acceso restringido</h2>
            <p className="text-amber-700 text-sm">Esta sección es exclusiva para administradores.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <OfflinePageGuard pageTitle="Usuarios">
      <div className="space-y-6 animate-in fade-in duration-500 pb-12">
        <div className="bg-white/40 dark:bg-slate-900/40 p-5 md:p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Usuarios
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                Gestión de credenciales: Administrador, Recepción y Piloto
              </p>
            </div>
            <Button onClick={c.abrirCrear}>
              <PlusCircle size={16} /> Nuevo usuario
            </Button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={inputClass + ' pl-9'}
              placeholder="Buscar por nombre o email…"
              value={c.searchInput}
              onChange={(e) => {
                c.handleSearchChange(e.target.value);
              }}
            />
          </div>
          <select
            className={inputClass + ' md:w-48'}
            value={c.roleFilter}
            onChange={(e) => {
              c.setRoleFilter(e.target.value as RoleFilter);
              c.setPage(1);
            }}
          >
            <option value="">Todos los roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="RECEPCION">RECEPCIÓN</option>
            <option value="PILOTO">PILOTO</option>
          </select>
        </div>

        {c.isPending ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : c.isError ? (
          <p className="text-center text-sm text-red-500 py-8">Error al cargar usuarios</p>
        ) : c.users.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">
            Sin usuarios para los filtros actuales
          </p>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            {/* Vista móvil: Fichas por usuario (< md) */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {c.users.map((u) => (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white text-base truncate">
                          {u.nombre}
                        </span>
                        {u.id === c.me?.id && (
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5 rounded-full shrink-0">
                            Tú
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                        u.role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                          : u.role === 'PILOTO'
                          ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-mono break-all">
                      <Mail size={13} className="text-slate-400 shrink-0" />
                      <span>{u.email}</span>
                    </div>
                    {u.createdAt && (
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <Calendar size={13} className="text-slate-400 shrink-0" />
                        <span>Registrado el {new Date(u.createdAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 min-h-9 flex items-center justify-center gap-1.5"
                      onClick={() => c.abrirEditar(u)}
                      aria-label={`Editar ${u.email}`}
                    >
                      <Pencil size={14} />
                      <span>Editar</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 min-h-9 flex items-center justify-center gap-1.5"
                      onClick={() => c.setPwModal({ id: u.id, nombre: u.nombre })}
                      aria-label={`Cambiar password ${u.email}`}
                    >
                      <KeyRound size={14} />
                      <span>Clave</span>
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="min-h-9 px-3 flex items-center justify-center"
                      onClick={() => c.confirmarEliminar(u)}
                      disabled={u.id === c.me?.id}
                      aria-label={`Eliminar ${u.email}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Vista escritorio: Tabla (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Nombre</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Rol</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">Creado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {c.users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {u.nombre}{' '}
                        {u.id === c.me?.id && (
                          <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                            Tú
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                              : u.role === 'PILOTO'
                              ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => c.abrirEditar(u)}
                            aria-label={`Editar ${u.email}`}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => c.setPwModal({ id: u.id, nombre: u.nombre })}
                            aria-label={`Cambiar password ${u.email}`}
                          >
                            <KeyRound size={14} />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => c.confirmarEliminar(u)}
                            disabled={u.id === c.me?.id}
                            aria-label={`Eliminar ${u.email}`}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {c.pagination && c.pagination.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-sm">
                <span className="text-slate-500">
                  Página {c.pagination.page} de {c.pagination.totalPages} — total {c.pagination.total}
                </span>
                <div className="flex gap-2 self-end sm:self-auto">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={c.page <= 1}
                    onClick={() => c.setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={c.page >= (c.pagination?.totalPages ?? 1)}
                    onClick={() => c.setPage((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <UserFormModal
          open={c.modalOpen}
          onClose={() => c.setModalOpen(false)}
          editingId={c.editingId}
          isSelfEditing={c.isSelfEditing}
          form={c.form}
          setForm={c.setForm}
          pilotos={c.pilotos}
          onSubmit={c.handleGuardar}
          isSubmitting={c.isSubmitting}
        />

        <UserPasswordModal
          pwModal={c.pwModal}
          onClose={() => c.setPwModal(null)}
          meId={c.me?.id}
          meRole={c.me?.role}
          pwForm={c.pwForm}
          setPwForm={c.setPwForm}
          onSubmit={c.handleCambiarPw}
          isPwSubmitting={c.isPwSubmitting}
        />
      </div>
    </OfflinePageGuard>
  );
}
