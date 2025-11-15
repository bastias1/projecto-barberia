import { Service } from "./services/service-service";

// Mock services - in real app, fetch from database using getServices()
export const SERVICES = [
  { id: 1, nombre: "Corte Clásico", descripcion: null, precio: 15000 },
  { id: 2, nombre: "Corte + Barba", descripcion: null, precio: 20000 },
  { id: 3, nombre: "Afeitado Tradicional", descripcion: null, precio: 12000 },
  { id: 4, nombre: "Corte Niño", descripcion: null, precio: 10000 },
] as Service[];

// Available time slots
export const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", 
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"
];

export type { Service };
