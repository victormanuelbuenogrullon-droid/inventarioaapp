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
  EyeOff
} from 'lucide-react';
import { fetchAllUsers, createNewUser, deleteUser, updateUserPassword } from '../utils/auth';

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
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Change password modal/inline state
  const [passwordChangeTarget, setPasswordChangeTarget] = useState(null);
  const [newCustomPassword, setNewCustomPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

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
      setError('Por favor completa todos los campos');
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
        role: newRole
      });

      setSuccessMessage(`✅ Usuario @${created.username} creado exitosamente.`);
      setNewName('');
      setNewUsername('');
      setNewPassword('');
      setNewRole('auditor');
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
      setSuccessMessage(`Contraseña de @${passwordChangeTarget.username} actualizada con éxito.`);
      setPasswordChangeTarget(null);
      setNewCustomPassword('');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      alert(err.message || 'Error al actualizar contraseña');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Gestión de Usuarios</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                  Panel de Administrador
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Solo tú puedes registrar, modificar contraseñas y eliminar usuarios del sistema
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

                    return (
                      <div key={u.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                        
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs shrink-0 ${
                            isAdmin 
                              ? 'bg-indigo-600 text-white' 
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
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                isAdmin 
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {isAdmin ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                {isAdmin ? 'Administrador' : 'Auditor / Operador'}
                              </span>
                              {u.createdAt && (
                                <span className="text-[10px] text-slate-400">
                                  Registrado: {new Date(u.createdAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordChangeTarget(u);
                              setNewCustomPassword('');
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-200 transition-colors"
                            title="Cambiar contraseña de este usuario"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Clave</span>
                          </button>

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
                  Podrán iniciar sesión desde su computadora o teléfono y cada producto que cuenten quedará registrado a su nombre.
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
                        Control total. Puede crear/eliminar usuarios, cambiar contraseñas y limpiar conteos.
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
