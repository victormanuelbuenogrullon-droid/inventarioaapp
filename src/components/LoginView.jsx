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
  Hash,
  Users,
  CreditCard
} from 'lucide-react';
import { loginUser, saveAuthSession } from '../utils/auth';
import { collaboratorLoginApi } from '../utils/socket';
import RequestAccessModal from './RequestAccessModal';

export default function LoginView({ onLoginSuccess }) {
  const [loginMode, setLoginMode] = useState('user'); // 'user' | 'collaborator'
  const [isRequestAccessOpen, setIsRequestAccessOpen] = useState(false);
  
  // Standard user form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Collaborator form state
  const [collabCode, setCollabCode] = useState('');
  const [collabName, setCollabName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Por favor ingresa tu usuario y contraseña');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await loginUser(username.trim(), password, sessionCode.trim());
      if (data && data.user) {
        onLoginSuccess(data.user, data.token, data.activeSession);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCollabSubmit = async (e) => {
    e.preventDefault();
    if (!collabCode.trim() || !collabName.trim()) {
      setErrorMessage('Por favor ingresa el Código de Sesión y tu Nombre');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await collaboratorLoginApi({
        sessionCode: collabCode.trim(),
        name: collabName.trim()
      });
      if (data && data.user) {
        saveAuthSession(data.token, data.user);
        onLoginSuccess(data.user, data.token, data.activeSession);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error al acceder a la sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col justify-center items-center p-3 sm:p-4 selection:bg-indigo-500 selection:text-white">
      
      {/* Decorative background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Brand Header */}
        <div className="text-center mb-5 sm:mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 mb-2.5 sm:mb-3 border border-indigo-400/20">
            <Barcode className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            InventariosApp
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 sm:mt-1">
            Sistema de Pase de Inventario Colaborativo en Tiempo Real
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-100/20 rounded-2xl shadow-2xl p-4 sm:p-7">
          
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mb-5 border border-slate-200">
            <button
              type="button"
              onClick={() => { setLoginMode('user'); setErrorMessage(null); }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                loginMode === 'user'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4 text-indigo-600" />
              <span>Auditor / Líder</span>
            </button>

            <button
              type="button"
              onClick={() => { setLoginMode('collaborator'); setErrorMessage(null); }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                loginMode === 'collaborator'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Auxiliar con Código</span>
            </button>
          </div>

          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {loginMode === 'user' ? 'Acceso con Cuenta' : 'Acceso de Colaborador'}
              </h2>
              <p className="text-xs text-slate-500">
                {loginMode === 'user' 
                  ? 'Ingresa con tu usuario y contraseña asignada'
                  : 'Ingresa el código proporcionado por tu supervisor'}
              </p>
            </div>
            <div className={`p-2 rounded-xl text-white ${loginMode === 'user' ? 'bg-slate-800' : 'bg-emerald-700'}`}>
              {loginMode === 'user' ? <ShieldCheck className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* MODE 1: STANDARD USER LOGIN */}
          {loginMode === 'user' && (
            <form onSubmit={handleUserSubmit} className="space-y-3.5">
              
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
                    placeholder="Usuario"
                    autoFocus
                    autoComplete="username"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña"
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

              {/* Optional Session Code Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Código de Sesión <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                    placeholder="Código de sesión (opcional)"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 rounded-xl text-sm font-mono uppercase text-indigo-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Si ya tienes un código de sesión específico, ingrésalo para entrar directamente.
                </p>
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
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <span>Ingresar al Sistema</span>
                )}
              </button>
            </form>
          )}

          {/* MODE 2: COLLABORATOR QUICK LOGIN WITH SESSION CODE */}
          {loginMode === 'collaborator' && (
            <form onSubmit={handleCollabSubmit} className="space-y-3.5">
              
              {/* Session Code Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Código de Sesión del Conteo <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={collabCode}
                    onChange={(e) => setCollabCode(e.target.value.toUpperCase())}
                    placeholder="Código de sesión"
                    autoFocus
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold uppercase text-emerald-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all tracking-wider"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Pídele este código a tu supervisor o auditor líder.
                </p>
              </div>

              {/* Collaborator Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tu Nombre o Número de Estación <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={collabName}
                    onChange={(e) => setCollabName(e.target.value)}
                    placeholder="Nombre o estación"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Conectando a la sesión...</span>
                  </>
                ) : (
                  <span>Unirme al Conteo</span>
                )}
              </button>
            </form>
          )}

          {/* Request Access Button */}
          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500 mb-2 font-medium">
              ¿No tienes una cuenta de acceso o deseas renovar?
            </p>
            <button
              type="button"
              onClick={() => setIsRequestAccessOpen(true)}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <span>Solicitar Acceso y Consultar Tarifas</span>
            </button>
          </div>

        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          © {new Date().getFullYear()} InventariosApp • Todos los derechos reservados
        </p>

      </div>

      {/* Request Access Modal */}
      <RequestAccessModal 
        isOpen={isRequestAccessOpen} 
        onClose={() => setIsRequestAccessOpen(false)} 
      />
    </div>
  );
}
