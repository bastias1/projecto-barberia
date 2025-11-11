// Mock services - in real app, fetch from database
export const SERVICES = [
  { id: 1, name: "Corte Clásico", duration: 60, price: 15000 },
  { id: 2, name: "Corte + Barba", duration: 60, price: 20000 },
  { id: 3, name: "Afeitado Tradicional", duration: 60, price: 12000 },
  { id: 4, name: "Corte Niño", duration: 60, price: 10000 },
];

// Available time slots
export const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", 
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"
];

export type Service = typeof SERVICES[number];
