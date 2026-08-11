/**
 * Convierte un nodo del DOM (un recibo/cotización ya renderizado) en una
 * imagen PNG, y ofrece dos acciones sobre ella:
 *
 *  - guardarImagen: la descarga directo al dispositivo.
 *  - compartirImagen: en celular (donde el navegador soporta compartir
 *    archivos), abre el selector nativo del sistema — el usuario elige
 *    WhatsApp (o cualquier otra app) y la imagen ya llega adjunta, igual
 *    que compartir una foto desde la galería. En navegadores sin ese
 *    soporte (la mayoría de escritorio), no hay forma de adjuntar un
 *    archivo a WhatsApp desde una web — como respaldo, se descarga la
 *    imagen y se abre WhatsApp Web con el texto ya escrito, para
 *    adjuntarla a mano.
 */
import html2canvas from "html2canvas";

async function generarImagen(el: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(el, {
    scale: 2, // nitidez — el doble de resolución de lo que se ve en pantalla
    backgroundColor: "#ffffff",
    useCORS: true,
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen"))),
      "image/png",
    );
  });
}

function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Genera la imagen del recibo y la descarga al dispositivo. */
export async function guardarImagen(el: HTMLElement, nombreArchivo: string): Promise<void> {
  const blob = await generarImagen(el);
  descargarBlob(blob, nombreArchivo);
}

/**
 * Genera la imagen y la comparte. En celular abre el selector nativo con la
 * imagen adjunta; si el navegador no lo soporta, descarga la imagen y abre
 * WhatsApp Web con el texto (el usuario adjunta la imagen a mano).
 */
export async function compartirImagen(
  el: HTMLElement,
  nombreArchivo: string,
  textoWhatsapp: string,
): Promise<void> {
  const blob = await generarImagen(el);
  const file = new File([blob], `${nombreArchivo}.png`, { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; text?: string; title?: string }) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], text: textoWhatsapp, title: nombreArchivo });
      return;
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return; // el usuario cerró el selector
      // cualquier otro error → cae al respaldo de abajo
    }
  }

  // Respaldo: descargar + abrir WhatsApp Web con el texto
  descargarBlob(blob, nombreArchivo);
  window.open(`https://wa.me/?text=${encodeURIComponent(textoWhatsapp)}`, "_blank");
}
