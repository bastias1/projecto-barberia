"use client"

interface ProgressStepsProps {
  currentStep: number;
  // Barberías con varias sucursales parten eligiendo sucursal (paso 0)
  conSucursal?: boolean;
}

const ETAPAS = ["Barbero", "Servicio", "Fecha y hora", "Tus datos"];

/** "Paso X de Y" con nombre de la etapa y barra; visible también en teléfono. */
export function ProgressSteps({ currentStep, conSucursal = false }: ProgressStepsProps) {
  const etapas = conSucursal ? ["Sucursal", ...ETAPAS] : ETAPAS;
  const indice = Math.min(Math.max(conSucursal ? currentStep : currentStep - 1, 0), etapas.length - 1);
  return (
    <div className="mb-6" role="group" aria-label="Progreso de la reserva">
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-semibold" aria-current="step">{etapas[indice]}</span>
        <span className="tabular text-muted-foreground">Paso {indice + 1} de {etapas.length}</span>
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {etapas.map((e, i) => (
          <span key={e} className={`h-1.5 flex-1 rounded-full ${i <= indice ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>
    </div>
  );
}
