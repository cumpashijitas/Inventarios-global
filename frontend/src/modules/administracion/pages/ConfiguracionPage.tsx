import { Settings } from "lucide-react";

import { ModuleComingSoon } from "@/shared/components/ModuleComingSoon";

// TODO backend: PATCH /api/v1/empresa/politicas (MFA, IPs, dispositivos),
// CRUD de empresa_ips_permitidas y dispositivos_autorizados.
// Funciones avanzadas (IP/device) son del addon "seguridad_avanzada".
export default function ConfiguracionPage() {
  return (
    <ModuleComingSoon
      icon={Settings}
      title="Configuración"
      description="Políticas de seguridad, sesiones, dispositivos autorizados y preferencias."
      plan="addon"
      features={[
        "Forzar MFA (TOTP) para todos los usuarios de la empresa",
        "Whitelist de IPs / CIDRs desde donde se permite el acceso",
        "Lista de dispositivos autorizados (cada usuario administra los suyos)",
        "Duración de sesión y límite de intentos fallidos antes de bloqueo",
        "Sesiones activas: forzar cierre remoto",
        "Notificación al admin ante intento de login desde IP nueva",
      ]}
    />
  );
}