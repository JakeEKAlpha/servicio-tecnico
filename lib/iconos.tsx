/**
 * Set de iconos de la app — un solo lugar, nombres semánticos.
 * Base: `lucide-react` (trazo currentColor, esquinas redondas). Importa de
 * aquí, no de "lucide-react" directo, para tener un único punto de cambio.
 *
 *   import { Pdf, Buscar } from "@/lib/iconos";
 *   <Pdf className="h-4 w-4" />
 *
 * Tamaño sugerido: 16 px (h-4 w-4) en botones y celdas, 18–20 px en cabeceras.
 */
export {
  // documentos / orden de servicio
  FileDown as Pdf,
  FileText as Doc,
  RefreshCw as Generar,
  Printer as Impresora,
  ClipboardList as OrdenServicio,
  // contacto
  Phone as Llamar,
  Mail as Correo,
  MapPin as Ubicacion,
  Map as Mapa,
  // acciones
  Search as Buscar,
  Copy as Copiar,
  Check as Listo,
  Plus as Agregar,
  Trash2 as Basura,
  Pencil as Editar,
  X as Cerrar,
  ChevronDown as Chevron,
  ChevronRight as ChevronDer,
  ArrowRight as Flecha,
  // navegación
  LayoutList as Tablero,
  CalendarDays as Agenda,
  Package as Almacen,
  Building2 as Gerencia,
  Settings as Config,
  Wrench as Campo,
  Home as Inicio,
  LogOut as Salir,
  User as Usuario,
  // estado / campo
  Clock as Reloj,
  TriangleAlert as Alerta,
  Camera as Foto,
  Play as Iniciar,
  Tag as Marca,
  MapPinned as Pin,
} from "lucide-react";

/** WhatsApp — lucide no trae iconos de marca; glifo propio. */
export function WhatsApp({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 21l1.6-3.9A8 8 0 1 1 8 20l-4 1zM9 9c-.3 0-.7.1-1 .5s-1 1-1 2 .8 2.3.9 2.5c.2.2 1.7 2.6 4 3.5 2 .8 2.4.6 2.8.6.5 0 1.5-.6 1.7-1.2s.2-1.1.1-1.2l-2-.9c-.2 0-.4-.1-.6.2l-.6.7c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.3 0-.4.1-.5l.5-.6c.1-.2.1-.3 0-.5l-.8-2c-.2-.4-.4-.4-.6-.4z" />
    </svg>
  );
}
