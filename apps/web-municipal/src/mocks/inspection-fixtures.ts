import type { FactorRiesgo } from "../components/FichaTerreno/types";

// Catálogos sintéticos del módulo recibido de Jesús. Solo se consumen en mock.
export const demoInspectionPoints = [
  { id: 1, name: "Av. Paicaví con Av. Los Carrera" },
  { id: 2, name: "Av. Arturo Prat con San Martín" },
  { id: 3, name: "Rengo con Ejército" },
  { id: 4, name: "Lincoyán con Ejército" },
] as const;

export const demoInspectionFactors: FactorRiesgo[] = [
  { id_factor: 1, nombre: "Falta de demarcación de cruce peatonal", descripcion: "Pintura termoplástica borrada o desgaste crítico en paso de cebra.", activo: true },
  { id_factor: 2, nombre: "Visibilidad reducida por obstrucciones", descripcion: "Kioscos, vegetación o paraderos generan punto ciego en aproximación.", activo: true },
  { id_factor: 3, nombre: "Falta de fase exclusiva semafórica", descripcion: "Viraje vehicular en conflicto directo con flujo peatonal preferente.", activo: true },
  { id_factor: 4, nombre: "Paradero colapsado en calzada", descripcion: "Buses viran o se detienen en segunda fila bloqueando la visual.", activo: true },
];
