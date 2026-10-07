import React from 'react';
import { Button, Input, Modal } from '@/components/ui';

interface UserPasswordModalProps {
  pwModal: { id: number; nombre: string } | null;
  onClose: () => void;
  meId?: number;
  meRole?: string;
  pwForm: { currentPassword: string; newPassword: string };
  setPwForm: React.Dispatch<React.SetStateAction<{ currentPassword: string; newPassword: string }>>;
  onSubmit: (e: React.FormEvent) => void;
  isPwSubmitting: boolean;
}

export function UserPasswordModal({
  pwModal,
  onClose,
  meId,
  meRole,
  pwForm,
  setPwForm,
  onSubmit,
  isPwSubmitting,
}: UserPasswordModalProps) {
  return (
    <Modal
      open={!!pwModal}
      onClose={onClose}
      title={`Cambiar contraseña — ${pwModal?.nombre ?? ''}`}
    >
      <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
        {meId === pwModal?.id && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Contraseña actual
            </label>
            <Input
              type="password"
              name="current-password"
              autoComplete="current-password"
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
              placeholder="Tu contraseña actual"
            />
            <p className="text-[11px] text-slate-400 mt-1">Requerida para confirmar tu identidad.</p>
          </div>
        )}

        {meId !== pwModal?.id && meRole !== 'ADMIN' && (
          <p className="text-xs text-amber-600">
            Solo un administrador puede cambiar la contraseña de otro usuario sin la actual.
          </p>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nueva contraseña
          </label>
          <Input
            type="password"
            name="new-password"
            autoComplete="new-password"
            data-lpignore="true"
            data-1p-ignore="true"
            value={pwForm.newPassword}
            onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
            placeholder="Mínimo 6 caracteres"
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPwSubmitting}>
            Actualizar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
