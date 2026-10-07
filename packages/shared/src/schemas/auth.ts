import { z } from 'zod';
import { RoleEnum } from './enums';

export const LoginPayloadSchema = z.object({
  email: z.string().email("Debe ser un email válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});
export type LoginPayload = z.infer<typeof LoginPayloadSchema>;

export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  nombre: z.string(),
  role: RoleEnum,
  pilotoId: z.number().nullable().optional(),
});
export type UserDTO = z.infer<typeof UserSchema>;

export const UserListableSchema = UserSchema.extend({
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});
export type UserListableDTO = z.infer<typeof UserListableSchema>;

export const CreateUserPayloadSchema = z.object({
  email: z.string().email("Debe ser un email válido"),
  nombre: z.string().min(1, "El nombre es obligatorio"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  role: RoleEnum.default('RECEPCION'),
  pilotoId: z.number().int().nullable().optional(),
});
export type CreateUserPayload = z.input<typeof CreateUserPayloadSchema>;

export const UpdateUserPayloadSchema = z.object({
  email: z.string().email("Debe ser un email válido").optional(),
  nombre: z.string().min(1, "El nombre es obligatorio").optional(),
  role: RoleEnum.optional(),
  pilotoId: z.number().int().nullable().optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
});
export type UpdateUserPayload = z.input<typeof UpdateUserPayloadSchema>;

export const ChangePasswordPayloadSchema = z.object({
  currentPassword: z.string().min(1, "Contraseña actual requerida").optional(),
  newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
});
export type ChangePasswordPayload = z.infer<typeof ChangePasswordPayloadSchema>;

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const GoogleLoginPayloadSchema = z.object({
  credential: z.string().min(10, 'Token de Google requerido'),
});
export type GoogleLoginPayload = z.infer<typeof GoogleLoginPayloadSchema>;
