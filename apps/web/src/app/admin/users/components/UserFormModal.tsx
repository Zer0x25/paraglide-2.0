import React from 'react';
import { Button, Input, Modal, inputClass } from '@/components/ui';
import type { PilotoDTO } from '@parapente/shared';
import type { UserFormState } from '../hooks/useAdminUsersController';

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  editingId: number | null;
  isSelfEditing: boolean;
  form: UserFormState;
  setForm: React.Dispatch<React.SetStateAction<UserFormState>>;
  pilotos: PilotoDTO[];
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
}

export function UserFormModal({
  open,
  onClose,
  editingId,
  isSelfEditing,
  form,
  setForm,
  pilotos,
  onSubmit,
  isSubmitting,
}: UserFormModalProps) {
  const title = editingId
    ? isSelfEditing
      ? 'Editar mi usuario'
      : 'Editar usuario'
    : 'Nuevo usuario';

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nombre
          </label>
          <Input
            name="new-user-name"
            autoComplete="off"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Ej: María García"
            required
          />
        </div>

        {!isSelfEditing && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <Input
                type="email"
                name="new-user-email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="usuario@parapente.cl"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {editingId ? 'Nueva contraseña (opcional)' : 'Contraseña'}
              </label>
              <Input
                type="password"
                name="new-user-password"
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore="true"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editingId ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}
                required={!editingId}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Rol
                </label>
                <select
                  className={inputClass}
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as UserFormState['role'] })
                  }
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="RECEPCION">RECEPCIÓN</option>
                  <option value="PILOTO">PILOTO</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Piloto vinculado (opcional)
                </label>
                <select
                  className={inputClass}
                  value={form.pilotoId}
                  onChange={(e) => setForm({ ...form, pilotoId: e.target.value })}
                >
                  <option value="">— Sin vínculo —</option>
                  {pilotos.map((p: PilotoDTO) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
