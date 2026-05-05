import { UserCog } from "lucide-react";

import { ModuleComingSoon } from "@/shared/components/ModuleComingSoon";

// TODO backend: módulo `administracion`. CRUD sobre usuarios_empresa,
// roles_empresa con permisos como jsonb. Invitaciones por email vía
// Supabase Auth (admin.inviteUserByEmail).
export default function UsuariosPage() {
  return (
    <ModuleComingSoon
      icon={UserCog}
      title="Usuarios y roles"
      description="Invita usuarios, asigna roles personalizados y controla permisos granulares."
      plan="core"
      features={[
        "Lista de usuarios con su rol, último login y estado",
        "Invitación por email (el usuario crea su propia password)",
        "Editor de roles: crear roles custom (vendedor, almacenero, contador, ...)",
        "Permisos granulares por acción (productos.crear, ventas.anular, etc.)",
        "Activar / desactivar / eliminar usuarios",
        "Forzar cierre de sesiones de un usuario en todos los dispositivos",
      ]}
    />
  );
}