export interface Database {
  public: {
    Tables: {
      servicio: {
        Row: {
          id: number;
          nombre: string;
          descripcion: string | null;
          precio: number;
        };
        Insert: {
          id?: number;
          nombre: string;
          descripcion?: string | null;
          precio: number;
        };
        Update: {
          id?: number;
          nombre?: string;
          descripcion?: string | null;
          precio?: number;
        };
      };
      reserva: {
        Row: {
          id: number;
          fecha: string;
          hora: string;
          estado: string;
          barbero: string | null;
          cliente: string | null;
          servicio: number;
        };
        Insert: {
          id?: number;
          fecha: string;
          hora: string;
          estado?: string;
          barbero?: string | null;
          cliente?: string | null;
          servicio: number;
        };
        Update: {
          id?: number;
          fecha?: string;
          hora?: string;
          estado?: string;
          barbero?: string | null;
          cliente?: string | null;
          servicio?: number;
        };
      };
      barbero: {
        Row: {
          id: string;
          especialidad: string | null;
        };
      };
      usuario: {
        Row: {
          id: string;
          nombre: string;
          apellido: string;
          correo: string;
          telefono: string | null;
          rol: string;
        };
        Insert: {
          id: string;
          nombre: string;
          apellido: string;
          correo: string;
          telefono?: string | null;
          rol?: string;
        };
      };
    };
  };
}
