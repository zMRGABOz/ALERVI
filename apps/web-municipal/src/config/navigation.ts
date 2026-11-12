import type { IconName } from "../components/UI/Icon";
import type { SessionRole } from "../types/session";
import { routes } from "./routes";

type NavigationItem = {
  id: string;
  label: string;
  icon: IconName;
  roles: readonly SessionRole[];
} & (
  | { href: string; unavailableReason?: never }
  | { href?: never; unavailableReason: string }
);

type NavigationGroup = {
  id: string;
  label: string;
  items: readonly NavigationItem[];
};

export const navigationDialogId = "menu-municipal";
const municipalRoles: readonly SessionRole[] = ["inspector", "administrador"];

export const municipalEntry = { label: "Espacio municipal", href: routes.summary } as const;
export const publicNavigation = [{ id: "map", label: "Mapa público", icon: "map", href: routes.map }] as const;

export const municipalNavigation: readonly NavigationGroup[] = [
  {
    id: "consulta",
    label: "Consulta municipal",
    items: [
      { id: "summary", label: "Resumen", icon: "summary", href: routes.summary, roles: municipalRoles },
      {
        id: "ranking",
        label: "Ranking de prioridades",
        icon: "ranking",
        href: routes.ranking,
        roles: municipalRoles,
      },
    ],
  },
  {
    id: "inspecciones",
    label: "Trabajo en terreno",
    items: [
      {
        id: "inspection",
        label: "Nueva inspección",
        icon: "inspection",
        roles: ["inspector"],
        unavailableReason: "Requiere un punto · Próximamente",
      },
      {
        id: "history",
        label: "Historial de fichas",
        icon: "history",
        roles: municipalRoles,
        unavailableReason: "Requiere un punto · Próximamente",
      },
    ],
  },
  {
    id: "configuracion",
    label: "Configuración",
    items: [
      {
        id: "weights",
        label: "Ponderaciones",
        icon: "settings",
        roles: ["administrador"],
        unavailableReason: "Próximamente",
      },
    ],
  },
];

export function getMunicipalNavigation(role: SessionRole | null): NavigationGroup[] {
  if (!role) return [];
  return municipalNavigation
    .map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(role)) }))
    .filter((group) => group.items.length > 0);
}
