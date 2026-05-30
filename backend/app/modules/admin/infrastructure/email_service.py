"""Servicio de email usando Resend (resend.com).

Resend tiene un tier gratuito: 3.000 emails/mes, 100/día.
SDK: pip install resend
"""
from __future__ import annotations

from datetime import datetime


def _html_stock_bajo(empresa_nombre: str, productos: list[dict]) -> str:
    """Genera el HTML del email de alerta de stock bajo."""
    fecha = datetime.now().strftime("%d/%m/%Y %H:%M")

    filas = ""
    for p in productos:
        stock  = round(float(p.get("stock_actual") or 0))
        minimo = round(float(p.get("stock_minimo") or 0))
        critico = stock == 0
        color   = "#ef4444" if critico else "#f97316"
        estado  = "SIN STOCK" if critico else "Stock bajo"
        filas += f"""
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:13px;color:#475569">{p.get("sku","")}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b">{p.get("nombre","")}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:700;color:{color}">{stock}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b">{minimo}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center">
            <span style="background:{color}22;color:{color};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600">{estado}</span>
          </td>
        </tr>
        """

    total = len(productos)
    criticos = sum(1 for p in productos if round(float(p.get("stock_actual") or 0)) == 0)

    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

        <!-- Header -->
        <div style="background:#1e293b;padding:28px 32px">
          <p style="margin:0;font-size:13px;color:#94a3b8;letter-spacing:.05em;text-transform:uppercase">Sistema de Inventario</p>
          <h1 style="margin:6px 0 0;font-size:22px;color:#ffffff">📦 Alerta de Stock Bajo</h1>
          <p style="margin:6px 0 0;font-size:13px;color:#64748b">{empresa_nombre} · {fecha}</p>
        </div>

        <!-- Resumen -->
        <div style="padding:24px 32px;border-bottom:1px solid #f1f5f9;display:flex;gap:24px">
          <div style="background:#fff7ed;border-radius:8px;padding:16px 24px;text-align:center;flex:1">
            <p style="margin:0;font-size:28px;font-weight:700;color:#ea580c">{total}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#9a3412">Productos bajo mínimo</p>
          </div>
          <div style="background:#fef2f2;border-radius:8px;padding:16px 24px;text-align:center;flex:1">
            <p style="margin:0;font-size:28px;font-weight:700;color:#dc2626">{criticos}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#991b1b">Sin stock</p>
          </div>
        </div>

        <!-- Tabla -->
        <div style="padding:24px 32px">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">SKU</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Producto</th>
                <th style="padding:8px 12px;text-align:center;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Stock</th>
                <th style="padding:8px 12px;text-align:center;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Mínimo</th>
                <th style="padding:8px 12px;text-align:center;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Estado</th>
              </tr>
            </thead>
            <tbody>{filas}</tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #f1f5f9">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center">
            Este reporte fue generado automáticamente por el sistema de inventario.
          </p>
        </div>

      </div>
    </body>
    </html>
    """


async def enviar_email_stock_bajo(
    api_key: str,
    email_from: str,
    email_to: str,
    empresa_nombre: str,
    productos: list[dict],
) -> bool:
    """
    Envía el email de alerta de stock usando Resend.
    Retorna True si fue exitoso.
    """
    try:
        import resend  # noqa: PLC0415
    except ImportError:
        raise RuntimeError("resend no está instalado. Ejecuta: uv add resend")

    resend.api_key = api_key

    total    = len(productos)
    criticos = sum(1 for p in productos if round(float(p.get("stock_actual") or 0)) == 0)
    asunto   = f"📦 {total} producto{'s' if total != 1 else ''} bajo mínimo" + (
        f" · {criticos} sin stock" if criticos else ""
    )

    params: resend.Emails.SendParams = {
        "from":    email_from,
        "to":      [email_to],
        "subject": asunto,
        "html":    _html_stock_bajo(empresa_nombre, productos),
    }

    resend.Emails.send(params)
    return True
