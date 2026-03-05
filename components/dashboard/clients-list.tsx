'use client';

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ClientStat, MonthlyAttendanceStat } from "@/lib/services/dashboard-service";
import { ClientDetailDialog } from "@/components/dashboard/client-detail-dialog";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Ban, ChevronDown, ChevronUp, ChevronsUpDown, Search, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

interface ClientsListProps {
  clients: ClientStat[];
  monthlyStats: MonthlyAttendanceStat[];
  barberId: string;
}

function AttendanceBadge({ percentage }: { percentage: number | null }) {
  if (percentage === null) {
    return (
      <Badge variant="outline" className="text-zinc-500 dark:text-zinc-400">
        Sin datos
      </Badge>
    );
  }
  if (percentage >= 75) {
    return (
      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50">
        {percentage}%
      </Badge>
    );
  }
  if (percentage >= 50) {
    return (
      <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50">
        {percentage}%
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50">
      {percentage}%
    </Badge>
  );
}

function AttendanceTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover text-popover-foreground shadow-sm p-2 text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-1.5">
          <span style={{ color: entry.color }}>●</span>
          <span>Asistencia: {entry.value}%</span>
        </div>
      ))}
    </div>
  );
}

type SortCol = 'nombre' | 'total_reservas' | 'attendance_percentage' | 'ultima_visita';

function SortableHeader({ col, label, active, dir, onSort, className }: {
  col: SortCol; label: string; active: boolean; dir: 'asc' | 'desc'; onSort: (col: SortCol) => void; className?: string;
}) {
  return (
    <button
      className={`flex items-center gap-1 hover:text-foreground transition-colors ${className ?? ''}`}
      onClick={() => onSort(col)}
    >
      {label}
      {active
        ? dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
    </button>
  );
}

const AVATAR_COLORS = [
  "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
  "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
  "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
  "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300",
];

function avatarColor(correo: string) {
  const hash = correo.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

function formatLastVisit(fecha: string | null) {
  if (!fecha) return "—";
  try {
    return format(parseISO(fecha), "dd MMM yyyy", { locale: es });
  } catch {
    return fecha;
  }
}

export function ClientsList({ clients: initialClients, monthlyStats, barberId }: ClientsListProps) {
  const [clients, setClients] = useState<ClientStat[]>(initialClients);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientStat | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  function handleToggleBlock(correo: string, bloqueado: boolean, razon_bloqueo?: string | null) {
    setClients((prev) =>
      prev.map((c) => c.correo === correo ? { ...c, bloqueado, razon_bloqueo: bloqueado ? (razon_bloqueo ?? c.razon_bloqueo) : null } : c)
    );
    setSelectedClient((prev) =>
      prev?.correo === correo ? { ...prev, bloqueado, razon_bloqueo: bloqueado ? (razon_bloqueo ?? prev.razon_bloqueo) : null } : prev
    );
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.apellido.toLowerCase().includes(q) ||
        c.correo.toLowerCase().includes(q)
    );
  }, [clients, search]);


  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      if (sortCol === 'nombre') {
        const aVal = `${a.nombre} ${a.apellido}`.toLowerCase();
        const bVal = `${b.nombre} ${b.apellido}`.toLowerCase();
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return sortDir === 'asc'
        ? aVal > bVal ? 1 : -1
        : aVal < bVal ? 1 : -1;
    });
  }, [filtered, sortCol, sortDir]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const newThisMonth = initialClients.filter((c) => c.primera_visita?.startsWith(currentMonth)).length;
  const newLastMonth = initialClients.filter((c) => c.primera_visita?.startsWith(lastMonth)).length;
  const activeThisMonth = initialClients.filter((c) => c.ultima_visita?.startsWith(currentMonth)).length;
  const blockedCount = initialClients.filter((c) => c.bloqueado).length;

  const pctChange = newLastMonth > 0
    ? Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 100)
    : null;

  const sparklineData = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-CL', { month: 'short' });
      months.push({ key, label, count: 0 });
    }
    for (const c of initialClients) {
      if (!c.primera_visita) continue;
      const prefix = c.primera_visita.slice(0, 7);
      const slot = months.find((m) => m.key === prefix);
      if (slot) slot.count++;
    }
    return months;
  }, [initialClients]);

  const hasChartData = monthlyStats.some((m) => m.completadas > 0 || m.ausentes > 0);

  const chartData = useMemo(() =>
    monthlyStats.map((m) => {
      const total = m.completadas + m.ausentes;
      return {
        month: m.month,
        asistencia: total > 0 ? Math.round((m.completadas / total) * 100) : 0,
        ausencia: total > 0 ? Math.round((m.ausentes / total) * 100) : 0,
      };
    }),
    [monthlyStats]
  );

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Unique clients */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clientes únicos
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <p className="text-4xl font-extrabold tracking-tight">{initialClients.length}</p>

            {/* Trend micro-copy */}
            <div className="flex items-center gap-1.5 mt-1">
              {pctChange !== null ? (
                <span className={`text-xs font-medium ${pctChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                  {pctChange >= 0 ? "↑" : "↓"} {Math.abs(pctChange)}% vs mes anterior
                </span>
              ) : newThisMonth > 0 ? (
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  +{newThisMonth} nuevos este mes
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">agrupados por correo</span>
              )}
            </div>

            {/* Sparkline */}
            {sparklineData.some((d) => d.count > 0) && (
              <div className="mt-3 -mx-2">
                <ResponsiveContainer width="100%" height={48}>
                  <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradNuevos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      fill="url(#gradNuevos)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Stat chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {newThisMonth > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                  +{newThisMonth} nuevos
                </span>
              )}
              {activeThisMonth > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  {activeThisMonth} activos este mes
                </span>
              )}
              {blockedCount > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                  {blockedCount} bloqueados
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Global attendance with area chart */}
        <Card className="shadow-sm sm:col-span-2 relative overflow-hidden">
          <div className="absolute top-3 left-4 z-10">
            <p className="text-sm font-medium text-muted-foreground">
              Tasa de asistencia global
            </p>
          </div>
          {hasChartData ? (
            <div className="pt-8">
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={chartData} margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradAsistencia" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<AttendanceTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="asistencia"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#gradAsistencia)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
              Sin datos de asistencia aún
            </div>
          )}
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o correo..."
          className="pl-9 bg-card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card className="py-0 gap-0">
        <CardContent className="p-0">
          <div className="rounded-md border overflow-hidden">
            {/* Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <div className="col-span-5">
                <SortableHeader col="nombre" label="Cliente" active={sortCol === 'nombre'} dir={sortDir} onSort={handleSort} />
              </div>
              <div className="col-span-2 flex justify-center">
                <SortableHeader col="total_reservas" label="Citas" active={sortCol === 'total_reservas'} dir={sortDir} onSort={handleSort} />
              </div>
              <div className="col-span-3 flex justify-center">
                <SortableHeader col="attendance_percentage" label="Asistencia" active={sortCol === 'attendance_percentage'} dir={sortDir} onSort={handleSort} />
              </div>
              <div className="col-span-2">
                <SortableHeader col="ultima_visita" label="Última visita" active={sortCol === 'ultima_visita'} dir={sortDir} onSort={handleSort} />
              </div>
            </div>

            {/* Rows */}
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-30" />
                <p className="font-medium">
                  {search
                    ? "Sin resultados para esa búsqueda"
                    : "Aún no hay clientes registrados"}
                </p>
                <p className="text-sm mt-1">
                  {search
                    ? "Intenta con otro nombre o correo"
                    : "Los clientes aparecerán aquí cuando tengas reservas"}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {sorted.map((client) => (
                  <div
                    key={client.correo}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-4 py-3 items-center cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      setSelectedClient(client);
                      setDialogOpen(true);
                    }}
                  >
                    {/* Avatar + name */}
                    <div className="col-span-5 flex items-center gap-3">
                      <div className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${client.bloqueado ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : avatarColor(client.correo)}`}>
                        {client.bloqueado ? <Ban className="h-4 w-4" /> : getInitials(client.nombre, client.apellido)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {client.nombre} {client.apellido}
                        </p>
                        {client.bloqueado && (
                          <p className="text-xs text-red-500 dark:text-red-400">Bloqueado</p>
                        )}
                      </div>
                    </div>

                    {/* Total bookings */}
                    <div className="col-span-2 md:text-center">
                      <p className="text-sm font-bold">{client.total_reservas}</p>
                    </div>

                    {/* Attendance % */}
                    <div className="col-span-3 flex md:justify-center">
                      <AttendanceBadge percentage={client.attendance_percentage} />
                    </div>

                    {/* Last visit */}
                    <div className="col-span-2 text-sm text-muted-foreground">
                      {formatLastVisit(client.ultima_visita)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Client detail dialog */}
      <ClientDetailDialog
        client={selectedClient}
        barberId={barberId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onToggleBlock={handleToggleBlock}
      />
    </div>
  );
}
