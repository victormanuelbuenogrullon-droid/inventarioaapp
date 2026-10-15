import React, { useState } from 'react';
import { 
  Barcode, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Loader2, 
  ShieldCheck, 
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { loginUser } from '../utils/auth';

export default function LoginView({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Por favor ingresa tu usuario y contraseña');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await loginUser(username.trim(), password);
      if (data && data.user) {
        onLoginSuccess(data.user, data.token);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      
      {/* Decorative background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 mb-3 border border-indigo-400/20">
            <Barcode className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            InventariosApp
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sistema de Pase de Inventario Colaborativo en Tiempo Real
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-100/20 rounded-2xl shadow-2xl p-6 sm:p-8">
          
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Iniciar Sesión</h2>
              <p className="text-xs text-slate-500">Ingresa tus credenciales para acceder</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Username Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin o tu usuario asignado"
                  autoFocus
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Contraseña
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando credenciales...</span>
                </>
              ) : (
                <span>Ingresar al Sistema</span>
              )}
            </button>
          </form>

          {/* Admin Setup Information Box */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Acceso Inicial de Administrador:</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-700 font-mono bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span>Usuario: <strong className="text-indigo-600 font-bold">admin</strong></span>
                <span>•</span>
                <span>Clave: <strong className="text-indigo-600 font-bold">admin</strong></span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                Como Administrador tendrás el botón exclusivo para crear usuarios a tus auditores o cambiar tu contraseña.
              </p>
            </div>
          </div>

        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          © {new Date().getFullYear()} InventariosApp • Todos los derechos reservados
        </p>

      </div>
    </div>
  );
}
