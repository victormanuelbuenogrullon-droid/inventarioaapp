import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Trash2, 
  Key, 
  X, 
  Loader2, 
  Check, 
  AlertCircle,
  User,
  Shield,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  Infinity as InfinityIcon
} from 'lucide-react';
import { 
  fetchAllUsers, 
  createNewUser, 
  deleteUser, 
  updateUserPassword,
  updateUserAccess 
} from '../utils/auth';

export default function UserManagementModal({ isOpen, onClose, currentUserId }) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('auditor');
  const [newAccessDays, setNewAccessDays] = useState(7); // 7 days by default, 0 for permanent
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Change password modal state
  const [passwordChangeTarget, setPasswordChangeTarget] = useState(null);
  const [newCustomPassword, setNewCustomPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Change access duration modal state
  const [accessDurationTarget, setAccessDurationTarget] = useState(null);
  const [selectedExtendDays, setSelectedExtendDays] = useState(7);
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAllUsers();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err) {
      setError(err.message || 'Error cargando usuarios');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMessage(null);
      loadUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword || !newName.trim()) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const created = await createNewUser({
        name: newName.trim(),
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
        accessDays: newAccessDays
      });

      const accessText = newAccessDays && Number(newAccessDays) > 0 ? `${newAccessDays} días` : 'Permanente';
      setSuccessMessage(`✅ Usuario @${created.username} creado con éxito (${accessText}).`);
      setNewName('');
      setNewUsername('');
      setNewPassword('');
      setNewRole('auditor');
      setNewAccessDays(7);
      await loadUsers();
      setActiveTab('list');
    } catch (err) {
      setError(err.message || 'Error al crear el usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (user) => {
    if (user.id === currentUserId) {
      alert('No puedes eliminar tu propia cuenta en uso.');
      return;
    }

    const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${user.name}" (@${user.username})?`);
    if (!confirmDelete) return;

    setError(null);
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setSuccessMessage(`Usuario @${user.username} eliminado.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message || 'Error al eliminar usuario');
    }
  };

  const handleSaveNewPassword = async (e) => {
    e.preventDefault();
    if (!passwordChangeTarget || !newCustomPassword || newCustomPassword.length < 4) {
      alert('La contraseña debe tener al menos 4 caracteres');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updateUserPassword(passwordChangeTarget.id, newCustomPassword);
      setSuccessMessage(`✅ Contraseña de @${passwordChangeTarget.username} actualizada con éxito.`);
      setPasswordChangeTarget(null);
      setNewCustomPassword('');
      await loadUsers();
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      alert(err.message || 'Error al actualizar contraseña');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSaveAccessDays = async () => {
    if (!accessDurationTarget) return;
    setIsUpdatingAccess(true);
    try {
      await updateUserAccess(accessDurationTarget.id, selectedExtendDays);
      const textVigencia = selectedExtendDays && Number(selectedExtendDays) > 0 
        ? `${selectedExtendDays} días a partir de hoy` 
        : 'Acceso Permanente';
      setSuccessMessage(`✅ Vigencia de @${accessDurationTarget.username} actualizada (${textVigencia}).`);
      setAccessDurationTarget(null);
      await loadUsers();
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      alert(err.message || 'Error al actualizar vigencia de acceso');
    } finally {
      setIsUpdatingAccess(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Gestión de Usuarios y Accesos</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                  Panel Administrador
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Crea cuentas, define días de vigencia y administra permisos para tu equipo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'list'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-indigo-500" />
            <span>Usuarios Registrados ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'create'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4 text-emerald-500" />
            <span>Crear Nuevo Usuario</span>
          </button>
        </div>

        {/* Global Feedback Notifications */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* TAB 1: USERS LIST */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {isLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-indigo-600" />
                  <p className="text-xs">Cargando lista de usuarios...</p>
                </div>
              ) : users.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No hay usuarios registrados</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  {users.map((u) => {
                    const isSelf = u.id === currentUserId;
                    const isAdmin = u.role === 'admin';

                    // Compute days remaining
                    let remainingDays = null;
                    let isExpired = false;
                    if (u.expiresAt) {
                      remainingDays = Math.ceil((new Date(u.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      isExpired = remainingDays <= 0;
                    }

                    return (
                      <div key={u.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                        
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs shrink-0 ${
                            isAdmin 
                              ? 'bg-indigo-600 text-white' 
                              : isExpired
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {u.name ? u.name.slice(0, 2).toUpperCase() : 'US'}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">{u.name}</span>
                              <span className="text-xs text-slate-400 font-mono">@{u.username}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md font-semibold">
                                  Tú
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {/* Role Badge */}
                              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                isAdmin 
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {isAdmin ? <Shield className="w-3 h-3 text-indigo-600" /> : <User className="w-3 h-3 text-slate-500" />}
                                {isAdmin ? 'Administrador' : 'Auditor'}
                              </span>

                              {/* Access Duration / Expiration Badge */}
                              {u.expiresAt ? (
                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  isExpired 
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                                    : remainingDays <= 2
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}>
                                  <Clock className="w-3 h-3" />
                                  {isExpired 
                                    ? `Acceso Vencido (${new Date(u.expiresAt).toLocaleDateString()})` 
                                    : `Vence en ${remainingDays} día${remainingDays === 1 ? '' : 's'} (${new Date(u.expiresAt).toLocaleDateString()})`}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                                  <InfinityIcon className="w-3 h-3 text-slate-400" />
                                  <span>Permanente</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          {/* Vigencia / Renovar días Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setAccessDurationTarget(u);
                              setSelectedExtendDays(u.accessDays || 7);
                            }}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-200 transition-colors shadow-2xs"
                            title="Renovar o modificar cantidad de días de acceso"
                          >
                            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="hidden sm:inline">Días</span>
                          </button>

                          {/* Cambiar Clave Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordChangeTarget(u);
                              setNewCustomPassword('');
                            }}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-200 transition-colors"
                            title="Cambiar contraseña de este usuario"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Clave</span>
                          </button>

                          {/* Eliminar Button */}
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            disabled={isSelf}
                            className={`p-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              isSelf
                                ? 'opacity-30 cursor-not-allowed border-slate-200 text-slate-400'
                                : 'text-rose-600 border-rose-200 hover:bg-rose-50'
                            }`}
                            title={isSelf ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CREATE NEW USER */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">Crea una cuenta para cada persona que vaya a inventariar</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Puedes definir por cuántos días tendrá permiso de acceso a la app. Cuando transcurran esos días, su acceso se bloqueará automáticamente.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  required
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre de Usuario (Login)
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="Ej: juanperez"
                  required
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Contraseña Inicial
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    required
                    className="w-full px-3.5 pr-10 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Access Duration / Days */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Vigencia de Acceso (Días permitidos)</span>
                  </label>
                  <span className="text-[11px] font-bold text-indigo-700">
                    {newAccessDays === 0 || !newAccessDays ? '♾️ Acceso Permanente' : `⏳ ${newAccessDays} días a partir de hoy`}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { label: '1 día', value: 1 },
                    { label: '3 días', value: 3 },
                    { label: '7 días', value: 7 },
                    { label: '15 días', value: 15 },
                    { label: '30 días', value: 30 },
                    { label: 'Permanente', value: 0 }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewAccessDays(opt.value)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        Number(newAccessDays) === opt.value
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1 text-xs text-slate-600">
                  <span>O cantidad personalizada:</span>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={newAccessDays === 0 ? '' : newAccessDays}
                    onChange={(e) => setNewAccessDays(e.target.value === '' ? 0 : Math.max(1, parseInt(e.target.value, 10) || 0))}
                    placeholder="Ej: 45"
                    className="w-20 px-2 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold bg-white text-slate-800"
                  />
                  <span>días</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Al vencerse el plazo, el usuario no podrá iniciar sesión hasta que tú como administrador le otorgues más días.
                </p>
              </div>

              {/* Role selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Rol y Permisos
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                    newRole === 'auditor'
                      ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="role"
                      value="auditor"
                      checked={newRole === 'auditor'}
                      onChange={() => setNewRole('auditor')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Auditor / Operador</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5 leading-snug">
                        Ideal para el personal de conteo. Cuenta productos y consulta catálogo. No puede gestionar usuarios.
                      </span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                    newRole === 'admin'
                      ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={newRole === 'admin'}
                      onChange={() => setNewRole('admin')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Administrador</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5 leading-snug">
                        Control total. Puede crear/eliminar usuarios, cambiar contraseñas y renovar vigencias.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Registrando usuario...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Crear Usuario</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Change password modal overlay */}
        {passwordChangeTarget && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-150">
              <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-600" />
                <span>Cambiar Contraseña</span>
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                Asigna una nueva clave para <strong>@{passwordChangeTarget.username}</strong>
              </p>

              <form onSubmit={handleSaveNewPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    value={newCustomPassword}
                    onChange={(e) => setNewCustomPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    autoFocus
                    required
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordChangeTarget(null);
                      setNewCustomPassword('');
                    }}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    {isUpdatingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Guardar Clave</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modify / Renew Access Duration Modal Overlay */}
        {accessDurationTarget && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-150">
              <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Asignar Días de Acceso</span>
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                Define la vigencia para <strong>@{accessDurationTarget.username}</strong> ({accessDurationTarget.name})
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Selecciona los días permitidos a partir de hoy:
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: '1 día', val: 1 },
                      { label: '3 días', val: 3 },
                      { label: '7 días', val: 7 },
                      { label: '15 días', val: 15 },
                      { label: '30 días', val: 30 },
                      { label: 'Permanente', val: 0 }
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setSelectedExtendDays(item.val)}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all text-center ${
                          Number(selectedExtendDays) === item.val
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-slate-500">O cantidad exacta:</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={selectedExtendDays === 0 ? '' : selectedExtendDays}
                      onChange={(e) => setSelectedExtendDays(e.target.value === '' ? 0 : Math.max(1, parseInt(e.target.value, 10) || 0))}
                      placeholder="Ej: 60"
                      className="w-20 px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                    <span className="text-xs text-slate-500">días</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAccessDurationTarget(null)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAccessDays}
                    disabled={isUpdatingAccess}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    {isUpdatingAccess ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Guardar Días</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
