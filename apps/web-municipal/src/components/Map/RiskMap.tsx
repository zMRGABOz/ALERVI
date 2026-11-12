"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import { QueryState } from "../UI/QueryState";
import type { PublicRiskPoint } from "./public-points";

export type MapFocusPoint = {
  point: PublicRiskPoint;
  scopeLabel: string;
};

export type RiskMapProps = {
  points: readonly PublicRiskPoint[];
  selectedId: number | null;
  selectionRevision?: number;
  focusPoint?: MapFocusPoint | null;
  ariaLabel?: string;
  onSelect: (id: number) => void;
};

const RiskMapClient = dynamic(() => import("./RiskMapClient"), {
  ssr: false,
  loading: () => <QueryState state="loading" title="Preparando mapa" description="La lista de puntos está disponible mientras carga la cartografía." />,
});

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (
      <QueryState state="error" title="Cartografía no disponible" description="No se pudo iniciar el mapa. Puedes consultar y seleccionar los puntos desde la lista." />
    ) : this.props.children;
  }
}

export function RiskMap(props: RiskMapProps) {
  return <MapBoundary><RiskMapClient {...props} /></MapBoundary>;
}
