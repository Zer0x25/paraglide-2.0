"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { apiRaw as api } from '../../services/api';
import { LogIn, KeyRound, Mail, AlertCircle } from 'lucide-react';
import { AuthResponse } from '@parapente/shared';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';

interface AuthConfigResponse {
  googleClientId?: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const setAuth = useAuthStore(state => state.setAuth);
  const router = useRouter();

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Silencioso si la API no está disponible o Google OAuth no está configurado:
  // el botón de Google simplemente no se muestra (mismo catch vacío de antes).
  const authConfigQuery = useQuery({
    queryKey: ['auth-config'],
    queryFn: () => api.get<AuthConfigResponse>('/auth/config'),
    staleTime: Infinity,
    retry: false,
  });
  const authConfig = authConfigQuery.data as unknown as AuthConfigResponse | undefined;
  const googleClientId = authConfig?.googleClientId || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await api.post<AuthResponse>('/auth/login', { email, password });
      
      // Axios response interceptor ya hace response.data pero lo tipamos
      const data = response as unknown as AuthResponse;
      
      setAuth(data.token, data.user);
      router.push('/');
    } catch (err: unknown) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Login error', err);
      }
      {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(typeof msg === 'string' ? msg : 'Error al iniciar sesión. Verifica tus credenciales.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (resp: CredentialResponse) => {
    const credential = resp.credential;
    if (!credential) {
      setError('No se recibió credencial de Google');
      return;
    }
    setError('');
    setIsGoogleLoading(true);
    try {
      const data = (await api.post<AuthResponse>('/auth/google', { credential })) as unknown as AuthResponse;
      setAuth(data.token, data.user);
      router.push('/');
    } catch (err: unknown) {
      if (process.env.NODE_ENV !== 'test') console.error('Google login error', err);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Error al iniciar sesión con Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Error al iniciar sesión con Google. Intenta nuevamente.');
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-white">
            Iniciar Sesión
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            Gestión de Vuelos Parapente
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-slate-100 dark:border-slate-800">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Correo Electrónico
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border"
                  placeholder="usuario@ejemplo.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Contraseña
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </div>
          </form>

          {googleClientId ? (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white dark:bg-slate-900 px-2 text-slate-500">o</span>
                </div>
              </div>
              <GoogleOAuthProvider clientId={googleClientId}>
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    useOneTap={false}
                    theme="outline"
                    size="large"
                    width="320"
                    text="continue_with"
                  />
                </div>
              </GoogleOAuthProvider>
              {isGoogleLoading && (
                <p className="text-center text-sm text-slate-500 mt-2">Verificando con Google...</p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
