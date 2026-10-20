import { Calendar, Clock, DollarSign, Users } from "lucide-react";

/**
 * Íconos de las estadísticas del Resumen. Se identifican por clave porque los
 * componentes no se pueden pasar como props de un Server a un Client Component.
 */
export const STAT_ICONS = {
  calendar: Calendar,
  dollar: DollarSign,
  users: Users,
  clock: Clock,
};

export interface StatItem {
  title: string;
  value: string | number;
  icon: keyof typeof STAT_ICONS;
  description: string;
  color: string;
  bgColor: string;
}
