export interface Database {
  public: {
    Tables: {
      servicio: {
        Row: {
          id: number;
          nombre: string;
          descripcion: string | null;
          precio: number;
          duracion: number | null;
        };
        Insert: {
          id?: number;
          nombre: string;
          descripcion?: string | null;
          precio: number;
          duracion?: number | null;
        };
        Update: {
          id?: number;
          nombre?: string;
          descripcion?: string | null;
          precio?: number;
          duracion?: number | null;
        };
      };
      reserva: {
        Row: {
          id: number;
          fecha: string;
          hora: string;
          estado: string;
          barbero: string;
          cliente: string | null;
          servicio: number;
          guest_cliente: string | null;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          fecha: string;
          hora: string;
          estado?: string;
          barbero: string;
          cliente?: string | null;
          servicio: number;
          guest_cliente?: string | null;
          notas?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          fecha?: string;
          hora?: string;
          estado?: string;
          barbero?: string;
          cliente?: string | null;
          servicio?: number;
          guest_cliente?: string | null;
          notas?: string | null;
          created_at?: string;
        };
      };
      barbero: {
        Row: {
          id: string;
          especialidad: string | null;
          nombre: string;
          apellido: string | null;
        };
      };
      barbero_servicio: {
        Row: {
          id: number;
          barbero: string;
          servicio: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          barbero: string;
          servicio: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          barbero?: string;
          servicio?: number;
          created_at?: string;
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
      guest_usuario: {
        Row: {
          id: string;
          nombre: string;
          apellido: string;
          correo: string;
          telefono: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          apellido: string;
          correo: string;
          telefono?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          apellido?: string;
          correo?: string;
          telefono?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
