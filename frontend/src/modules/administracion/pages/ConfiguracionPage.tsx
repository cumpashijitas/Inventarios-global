import {
  Building2, Check, Loader2, Pencil, Plus, Settings, Shield, Trash2, Users, Wifi, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  adminApi,
  type EmpresaConfig, type IpPermitida, type RolAdmin, type SistemaConfig, type UsuarioAdmin,
} from "@/modules/administracion/services/adminApi";
import { ROL_LABEL } from "@/shared/config/roles";

type Tab = "general" | "usuarios" | "sistema" | "acceso";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function RolBadge({ codigo }: { codigo: string }) {
  const colors: Record<string, string> = {
    admin:                "bg-red-100 text-red-700",
    vendedor:             "bg-blue-100 text-blue-700",
    encargado_inventario: "bg-amber-100 text-amber-700",
    cajero:               "bg-green-100 text-green-700",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[codigo] ?? "bg-slate-100 text-slate-600"}`}>
      {ROL_LABEL[codigo] ?? codigo}
    </span>
  );
}

function Avatar({ nombre }: { nombre: string }) {
  const initials = nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
      {initials}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <Settings className="h-5 w-5 text-indigo-600" />
          Configuración del Sistema
        </h1>
        <p className="text-sm text-slate-500">Administra la configuración general y usuarios</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-5 pt-1">
          {([
            { key: "general",  label: "General",        icon: Building2 },
            { key: "usuarios", label: "Usuarios y Roles", icon: Users },
            { key: "sistema",  label: "Sistema",         icon: Shield },
            { key: "acceso",   label: "Control de Acceso", icon: Wifi },
          ] as { key: Tab; label: string; icon: React.ElementType }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px mr-6 flex items-center gap-1.5 border-b-2 py-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "general"  && <TabGeneral />}
          {tab === "usuarios" && <TabUsuarios />}
          {tab === "sistema"  && <TabSistema />}
          {tab === "acceso"   && <TabAcceso />}
        </div>
      </div>
    </div>
  );
}

// ─── Tab General ──────────────────────────────────────────────────────────────

function TabGeneral() {
  const [empresa, setEmpresa]   = useState<EmpresaConfig | null>(null);
  const [form, setForm]         = useState<Partial<EmpresaConfig>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState(false);

  useEffect(() => {
    adminApi.getEmpresa()
      .then((e) => { setEmpresa(e); setForm(e); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleGuardar = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const updated = await adminApi.updateEmpresa(form);
      setEmpresa(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-10 text-center text-slate-400 text-sm">Cargando…</div>;
  if (!empresa) return <div className="py-10 text-center text-red-400 text-sm">No se pudo cargar la empresa</div>;

  const f = (k: keyof EmpresaConfig) => (v: string) => setForm((p) => ({ ...p, [k]: v || undefined }));

  return (
    <div className="max-w-2xl space-y-5">
      <h2 className="text-sm font-semibold text-slate-700">Información de la Empresa</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre de la Empresa *" value={form.razon_social ?? ""} onChange={f("razon_social")} />
        <Field label="RUC / NIT" value={form.nit ?? ""} onChange={f("nit")} />
        <div className="col-span-2">
          <Field label="Dirección" value={form.direccion ?? ""} onChange={f("direccion")} />
        </div>
        <Field label="Ciudad" value={form.ciudad ?? ""} onChange={f("ciudad")} />
        <Field label="País" value={form.pais ?? ""} onChange={f("pais")} />
        <Field label="Teléfono" value={form.telefono ?? ""} onChange={f("telefono")} type="tel" />
        <Field label="Email de contacto" value={form.email ?? ""} onChange={f("email")} type="email" />
        <Field label="Nombre comercial" value={form.nombre_comercial ?? ""} onChange={f("nombre_comercial")} />
        <div>
          <Label className="text-xs font-semibold text-slate-600">Moneda principal</Label>
          <select
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.moneda_principal ?? "BOB"}
            onChange={(e) => setForm((p) => ({ ...p, moneda_principal: e.target.value }))}
          >
            <option value="BOB">BOB — Boliviano</option>
            <option value="USD">USD — Dólar americano</option>
            <option value="PEN">PEN — Sol peruano</option>
            <option value="ARS">ARS — Peso argentino</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={handleGuardar}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Guardando…" : "Guardar Cambios"}
        </Button>
        {success && (
          <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
            <Check className="h-4 w-4" /> Guardado correctamente
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Tab Usuarios y Roles ─────────────────────────────────────────────────────

function TabUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [roles, setRoles]       = useState<RolAdmin[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<{ open: boolean; usuario: UsuarioAdmin | null }>({ open: false, usuario: null });
  const [deleteConfirm, setDeleteConfirm] = useState<UsuarioAdmin | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Form para crear/editar
  const [form, setForm] = useState({ nombre: "", email: "", password: "", rol_codigo: "" });

  const cargar = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([adminApi.listUsuarios(), adminApi.listRoles()]);
      setUsuarios(u);
      setRoles(r);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const abrirCrear = () => {
    setForm({ nombre: "", email: "", password: "", rol_codigo: roles[1]?.codigo ?? "vendedor" });
    setError(null);
    setModal({ open: true, usuario: null });
  };

  const abrirEditar = (u: UsuarioAdmin) => {
    setForm({ nombre: u.nombre, email: u.email, password: "", rol_codigo: u.rol_codigo });
    setError(null);
    setModal({ open: true, usuario: u });
  };

  const handleGuardar = async () => {
    setError(null);
    setSaving(true);
    try {
      if (modal.usuario) {
        // Editar
        const body: Record<string, unknown> = {};
        if (form.nombre !== modal.usuario.nombre) body.nombre = form.nombre;
        if (form.rol_codigo !== modal.usuario.rol_codigo) body.rol_codigo = form.rol_codigo;
        await adminApi.updateUsuario(modal.usuario.id, body);
      } else {
        // Crear
        if (!form.nombre.trim() || !form.email.trim() || !form.password.trim()) {
          setError("Nombre, email y contraseña son obligatorios"); return;
        }
        await adminApi.createUsuario(form);
      }
      await cargar();
      setModal({ open: false, usuario: null });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Error al guardar. Verifica los datos.");
    } finally { setSaving(false); }
  };

  const handleDesactivar = async (u: UsuarioAdmin) => {
    setSaving(true);
    try {
      if (u.activo) {
        await adminApi.deactivateUsuario(u.id);
      } else {
        await adminApi.updateUsuario(u.id, { activo: true });
      }
      await cargar();
      setDeleteConfirm(null);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-10 text-center text-slate-400 text-sm">Cargando usuarios…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Gestión de Usuarios</h2>
          <p className="text-xs text-slate-400">{usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""} registrado{usuarios.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={abrirCrear} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm">
          <Plus className="h-4 w-4" /> Agregar Usuario
        </Button>
      </div>

      {/* Tabla de usuarios */}
      <div className="overflow-auto rounded-lg border border-slate-200" style={{ maxHeight: "calc(100vh - 400px)" }}>
        <table className="w-full text-sm border-collapse [&_td]:border [&_td]:border-slate-200">
          <thead className="sticky top-0 z-10">
            <tr>
              {["USUARIO", "EMAIL", "ROL", "ESTADO", "FECHA DE REGISTRO", "ACCIONES"].map((h) => (
                <th key={h} className="border border-amber-500 bg-amber-400 px-3 py-2 text-left font-bold text-black whitespace-nowrap uppercase tracking-wide text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u, idx) => (
              <tr key={u.id} className={idx % 2 === 0 ? "bg-white hover:bg-amber-100/60" : "bg-amber-50/40 hover:bg-amber-100/60"}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar nombre={u.nombre} />
                    <span className="font-semibold text-slate-800">{u.nombre}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3"><RolBadge codigo={u.rol_codigo} /></td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${u.activo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {u.activo ? "• Activo" : "• Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {new Date(u.created_at).toLocaleDateString("es-BO")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => abrirEditar(u)} className="rounded p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(u)}
                      className={`rounded p-1 ${u.activo ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-slate-300 hover:text-green-600 hover:bg-green-50"}`}
                    >
                      {u.activo ? <Trash2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal crear / editar */}
      <Dialog open={modal.open} onOpenChange={(o) => !o && setModal({ open: false, usuario: null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{modal.usuario ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Field label="Nombre completo *" value={form.nombre} onChange={(v) => setForm((p) => ({ ...p, nombre: v }))} placeholder="Ej: Carlos Mendoza" />
            {!modal.usuario && (
              <>
                <Field label="Email *" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="correo@empresa.com" type="email" />
                <Field label="Contraseña *" value={form.password} onChange={(v) => setForm((p) => ({ ...p, password: v }))} placeholder="Mínimo 6 caracteres" type="password" />
              </>
            )}
            <div>
              <Label className="text-xs font-semibold text-slate-600">Rol</Label>
              <select
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.rol_codigo}
                onChange={(e) => setForm((p) => ({ ...p, rol_codigo: e.target.value }))}
              >
                {roles.map((r) => (
                  <option key={r.codigo} value={r.codigo}>{r.nombre}</option>
                ))}
              </select>
            </div>
            {/* Descripción del rol seleccionado */}
            {form.rol_codigo && (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                {roles.find((r) => r.codigo === form.rol_codigo)?.descripcion}
              </p>
            )}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal({ open: false, usuario: null })}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {modal.usuario ? "Guardar Cambios" : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm desactivar/activar */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{deleteConfirm?.activo ? "Desactivar usuario" : "Activar usuario"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            {deleteConfirm?.activo
              ? `¿Desactivar a ${deleteConfirm?.nombre}? No podrá iniciar sesión hasta que se reactive.`
              : `¿Activar a ${deleteConfirm?.nombre}? Recuperará acceso al sistema.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              onClick={() => deleteConfirm && handleDesactivar(deleteConfirm)}
              disabled={saving}
              className={deleteConfirm?.activo ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {deleteConfirm?.activo ? "Desactivar" : "Activar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab Sistema ──────────────────────────────────────────────────────────────

const TOGGLES_META: { key: keyof SistemaConfig; label: string; sub: string }[] = [
  { key: "notificaciones_email", label: "Notificaciones por Email", sub: "Alertas de stock bajo y ventas importantes al email de la empresa" },
  { key: "alertas_stock_bajo",   label: "Alertas de Stock Bajo",   sub: "Mostrar aviso en el dashboard cuando un producto baje del mínimo" },
];

const INFO_SISTEMA = [
  { label: "Versión",              value: "v1.0.0" },
  { label: "Última actualización", value: new Date().toLocaleDateString("es-BO") },
  { label: "Base de datos",        value: "PostgreSQL 15" },
  { label: "Entorno",              value: "Producción" },
  { label: "Backup automático",    value: "✓ Activo — gestionado por Supabase" },
  { label: "Retención de backups", value: "7 días (plan actual)" },
];

function TabSistema() {
  const [config, setConfig]   = useState<SistemaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<keyof SistemaConfig | null>(null);

  useEffect(() => {
    adminApi.getSistema()
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (key: keyof SistemaConfig) => {
    if (!config || saving) return;
    const nuevoValor = !config[key];
    // Optimistic update
    setConfig((p) => p ? { ...p, [key]: nuevoValor } : p);
    setSaving(key);
    try {
      const updated = await adminApi.updateSistema({ [key]: nuevoValor });
      setConfig(updated);
    } catch (err) {
      // Revert on error
      setConfig((p) => p ? { ...p, [key]: !nuevoValor } : p);
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="py-10 text-center text-slate-400 text-sm">Cargando…</div>;
  if (!config)  return <div className="py-10 text-center text-red-400 text-sm">No se pudo cargar la configuración</div>;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Configuración del Sistema</h2>
        <div className="space-y-2">
          {TOGGLES_META.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5"
            >
              <div>
                <p className="text-sm font-medium text-slate-700">{item.label}</p>
                <p className="text-xs text-indigo-500 mt-0.5">{item.sub}</p>
              </div>
              <button
                onClick={() => handleToggle(item.key)}
                disabled={saving === item.key}
                aria-label={`Activar/desactivar ${item.label}`}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                  config[item.key] ? "bg-slate-800" : "bg-slate-300"
                } ${saving === item.key ? "opacity-60" : ""}`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    config[item.key] ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Información del Sistema</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INFO_SISTEMA.map((i) => (
            <div key={i.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-400">{i.label}</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">{i.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab Control de Acceso ────────────────────────────────────────────────────

function TabAcceso() {
  const [ips, setIps]           = useState<IpPermitida[]>([]);
  const [miIp, setMiIp]         = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [descripcion, setDescripcion] = useState("");
  const [adding, setAdding]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const cargar = async () => {
    try {
      const [lista, ip] = await Promise.all([adminApi.listIps(), adminApi.getMiIp()]);
      setIps(lista);
      setMiIp(ip);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const handleAgregar = async () => {
    if (!miIp) return;
    setAdding(true);
    try {
      await adminApi.addIp(miIp, descripcion || "Red de la tienda");
      setDescripcion("");
      await cargar();
    } catch (err) { console.error(err); }
    finally { setAdding(false); }
  };

  const handleEliminar = async (id: string) => {
    setDeletingId(id);
    try {
      await adminApi.deleteIp(id);
      setIps((prev) => prev.filter((ip) => ip.id !== id));
    } catch (err) { console.error(err); }
    finally { setDeletingId(null); }
  };

  const yaRegistrada = miIp ? ips.some((ip) => ip.ip === miIp) : false;

  if (loading) return <div className="py-10 text-center text-slate-400 text-sm">Cargando…</div>;

  return (
    <div className="max-w-lg space-y-6">
      {/* Info */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3.5">
        <p className="text-sm font-medium text-blue-800">¿Cómo funciona?</p>
        <p className="mt-1 text-xs text-blue-600 leading-relaxed">
          Los empleados solo pueden acceder al sistema desde redes registradas aquí.
          El administrador puede entrar desde cualquier lugar. Si la lista está vacía,
          no hay restricción de red.
        </p>
      </div>

      {/* IP actual */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Tu red actual</h2>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
          <div className="flex-1">
            <p className="text-xs text-slate-400">IP pública detectada</p>
            <p className="text-base font-mono font-semibold text-slate-800 mt-0.5">{miIp}</p>
          </div>
          {yaRegistrada ? (
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              <Check className="h-3 w-3" /> Registrada
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Descripción (opcional)"
                className="h-8 w-44 text-xs"
              />
              <button
                onClick={handleAgregar}
                disabled={adding}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Agregar mi red
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lista de IPs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Redes autorizadas</h2>
          <span className="text-xs text-slate-400">{ips.length} red{ips.length !== 1 ? "es" : ""} registrada{ips.length !== 1 ? "s" : ""}</span>
        </div>

        {ips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <Wifi className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">Sin redes registradas</p>
            <p className="text-xs text-slate-300 mt-1">Mientras la lista esté vacía, cualquier red puede acceder</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ips.map((ip) => (
              <div
                key={ip.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-800">{ip.ip}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {ip.descripcion || "Sin descripción"} · {new Date(ip.created_at).toLocaleDateString("es-BO")}
                  </p>
                </div>
                <button
                  onClick={() => handleEliminar(ip.id)}
                  disabled={deletingId === ip.id}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  {deletingId === ip.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aviso IP dinámica */}
      {ips.length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Aviso:</strong> Si el router de la tienda reinicia o el ISP cambia la IP,
            los empleados quedarán bloqueados. El admin puede entrar desde cualquier red
            y registrar la nueva IP desde esta pantalla.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder = "", type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      <Input
        className="mt-1"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
