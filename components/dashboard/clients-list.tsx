'use client';

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ClientStat, MonthlyAttendanceStat } from "@/lib/services/dashboard-service";
import { ClientDetailDialog } from "@/components/dashboard/client-detail-dialog";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Search, User, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
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

export function ClientsList({ clients, monthlyStats, barberId }: ClientsListProps) {
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientStat | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const globalAttendance = useMemo(() => {
    const totalCompletadas = clients.reduce((s, c) => s + c.completadas, 0);
    const totalResolved = clients.reduce((s, c) => s + c.completadas + c.ausentes, 0);
    return totalResolved > 0 ? Math.round((totalCompletadas / totalResolved) * 100) : null;
  }, [clients]);

  const hasChartData = monthlyStats.some((m) => m.completadas > 0 || m.ausentes > 0);

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Unique clients */}
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clientes únicos
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{clients.length}</p>
            <p className="text-xs text-muted-foreground mt-1">agrupados por correo</p>
          </CardContent>
        </Card>

        {/* Global attendance with area chart */}
        <Card className="border-2 sm:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tasa de asistencia global
              </CardTitle>
              <p className="text-3xl font-bold mt-1">
                {globalAttendance !== null ? `${globalAttendance}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                sobre citas con resultado registrado
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {hasChartData ? (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart
                  data={monthlyStats}
                  margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradCompletadas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradAusentes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    opacity={0.08}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      fontSize: "12px",
                    }}
                    formatter={(value, name) => [
                      value,
                      name === "completadas" ? "Asistieron" : "No asistieron",
                    ]}
                  />
                  <Legend
                    formatter={(value) =>
                      value === "completadas" ? "Asistieron" : "No asistieron"
                    }
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="completadas"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#gradCompletadas)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ausentes"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#gradAusentes)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
                Sin datos de asistencia aún
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o correo..."
          className="pl-9"
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
              <div className="col-span-5">Cliente</div>
              <div className="col-span-2 text-center">Citas</div>
              <div className="col-span-3 text-center">Asistencia</div>
              <div className="col-span-2">Última visita</div>
            </div>

            {/* Rows */}
            {filtered.length === 0 ? (
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
                {filtered.map((client) => (
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
                      <div className="h-10 w-10 flex-shrink-0 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {getInitials(client.nombre, client.apellido)}
                      </div>
                      <p className="font-semibold text-sm truncate">
                        {client.nombre} {client.apellido}
                      </p>
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
      />
    </div>
  );
}
