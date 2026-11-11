import type { IconName } from "../components/UI/Icon";
import { routes } from "./routes";

type NavigationItem = {
  id: string;
  label: string;
  icon: IconName;
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

export const municipalNavigation: readonly NavigationGroup[] = [
  {
    id: "consulta",
    label: "Consulta municipal",
    items: [
      { id: "summary", label: "Resumen", icon: "summary", href: routes.summary },
      {
        id: "ranking",
        label: "Ranking de prioridades",
        icon: "ranking",
        unavailableReason: "Próximamente",
      },
      {
        id: "point",
        label: "Detalle del punto",
        icon: "point",
        unavailableReason: "Requiere un punto · Próximamente",
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
        unavailableReason: "Requiere un punto · Próximamente",
      },
      {
        id: "history",
        label: "Historial de fichas",
        icon: "history",
        unavailableReason: "Requiere un punto · Próximamente",
      },
    ],
  },
];
