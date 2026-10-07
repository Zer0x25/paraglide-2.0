import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import typedApi from '@/services/api';
import type {
  UserListableDTO,
  CreateUserPayload,
  UpdateUserPayload,
  ChangePasswordPayload,
  PilotoDTO,
  ListEnvelope,
} from '@parapente/shared';

export type RoleFilter = '' | 'ADMIN' | 'PILOTO' | 'RECEPCION';

export interface UserFormState {
  nombre: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'PILOTO' | 'RECEPCION';
  pilotoId: string;
}

export const FORM_VACIO: UserFormState = {
  nombre: '',
  email: '',
  password: '',
  role: 'RECEPCION',
  pilotoId: '',
};

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error !== null && typeof error === 'object' && 'response' in error) {
    const resp = (error as { response?: { data?: { error?: string } } }).response;
    if (resp?.data?.error) return resp.data.error;
  }
  return fallback;
}

export function useAdminUsersController() {
  const { user: me } = useAuthStore();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UserFormState>(FORM_VACIO);

  const [pwModal, setPwModal] = useState<{ id: number; nombre: string } | null>(null);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setQ(value);
      setPage(1);
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  const queryParams = useMemo(() => {
    const p: Record<string, unknown> = { page, pageSize };
    if (q.trim()) p.q = q.trim();
    if (roleFilter) p.role = roleFilter;
    return p;
  }, [q, roleFilter, page]);

  const { data, isPending, isError } = useQuery<ListEnvelope<UserListableDTO>>({
    queryKey: ['users', queryParams],
    queryFn: () => typedApi.users.listar(queryParams),
    enabled: !me || me.role === 'ADMIN',
  });

  const users: UserListableDTO[] = data?.data ?? [];
  const pagination = data?.pagination;

  const pilotosQuery = useQuery<ListEnvelope<PilotoDTO>>({
    queryKey: ['pilotos-lite'],
    queryFn: () => typedApi.pilotos.listar({ pageSize: 100 }),
    enabled: modalOpen,
  });
  const pilotos: PilotoDTO[] = pilotosQuery.data?.data ?? [];

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const abrirCrear = () => {
    setEditingId(null);
    setForm(FORM_VACIO);
    setModalOpen(true);
  };

  const abrirEditar = (u: UserListableDTO) => {
    setEditingId(u.id);
    setForm({
      nombre: u.nombre,
      email: u.email,
      password: '',
      role: u.role as UserFormState['role'],
      pilotoId: u.pilotoId ? String(u.pilotoId) : '',
    });
    setModalOpen(true);
  };

  const isSelfEditing = editingId !== null && me?.id === editingId;

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => typedApi.users.crear(payload),
    onSuccess: () => {
      toast.success('Usuario creado');
      setModalOpen(false);
      invalidar();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'No se pudo crear el usuario')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUserPayload }) =>
      typedApi.users.actualizar(id, payload as unknown as Record<string, unknown>),
    onSuccess: (updatedUser: unknown, variables) => {
      toast.success('Usuario actualizado');
      if (me && variables.id === me.id && updatedUser && typeof updatedUser === 'object') {
        const updated = { ...me, ...(updatedUser as Partial<typeof me>) };
        try {
          localStorage.setItem('user', JSON.stringify(updated));
        } catch {
          // ignorar fallos de localStorage
        }
        useAuthStore.setState({ user: updated });
      }
      setModalOpen(false);
      invalidar();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'No se pudo actualizar el usuario')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => typedApi.users.eliminar(id),
    onSuccess: () => {
      toast.success('Usuario eliminado');
      invalidar();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'No se pudo eliminar')),
  });

  const pwMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ChangePasswordPayload }) =>
      typedApi.users.cambiarPassword(id, payload),
    onSuccess: () => {
      toast.success('Contraseña actualizada');
      setPwModal(null);
      setPwForm({ currentPassword: '', newPassword: '' });
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'No se pudo cambiar la contraseña')),
  });

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (!isSelfEditing && !form.email.trim()) {
      toast.error('Nombre y email son obligatorios');
      return;
    }
    if (!editingId && !form.password) {
      toast.error('La contraseña es obligatoria al crear');
      return;
    }

    if (editingId) {
      if (isSelfEditing) {
        updateMutation.mutate({
          id: editingId,
          payload: { nombre: form.nombre.trim() },
        });
      } else {
        const pilotoId = form.pilotoId ? Number(form.pilotoId) : null;
        const payload: UpdateUserPayload = {
          nombre: form.nombre.trim(),
          email: form.email.trim(),
          role: form.role,
          pilotoId,
          ...(form.password ? { password: form.password } : {}),
        };
        updateMutation.mutate({ id: editingId, payload });
      }
    } else {
      const pilotoId = form.pilotoId ? Number(form.pilotoId) : null;
      const payload: CreateUserPayload = {
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        pilotoId,
      };
      createMutation.mutate(payload);
    }
  };

  const handleCambiarPw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwModal) return;
    if (!pwForm.newPassword || pwForm.newPassword.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    const isSelf = me?.id === pwModal.id;
    const payload: ChangePasswordPayload = { newPassword: pwForm.newPassword };
    if (isSelf) payload.currentPassword = pwForm.currentPassword;
    else if (pwForm.currentPassword) payload.currentPassword = pwForm.currentPassword;

    pwMutation.mutate({ id: pwModal.id, payload });
  };

  const confirmarEliminar = (u: UserListableDTO) => {
    if (u.id === me?.id) {
      toast.error('No puedes eliminar tu propio usuario');
      return;
    }
    if (window.confirm(`¿Eliminar al usuario "${u.nombre}" (${u.email})?`)) {
      deleteMutation.mutate(u.id);
    }
  };

  return {
    me,
    searchInput,
    handleSearchChange,
    roleFilter,
    setRoleFilter,
    page,
    setPage,
    pageSize,
    users,
    pagination,
    isPending,
    isError,
    pilotos,
    modalOpen,
    setModalOpen,
    editingId,
    form,
    setForm,
    isSelfEditing,
    pwModal,
    setPwModal,
    pwForm,
    setPwForm,
    abrirCrear,
    abrirEditar,
    handleGuardar,
    handleCambiarPw,
    confirmarEliminar,
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    isPwSubmitting: pwMutation.isPending,
  };
}
