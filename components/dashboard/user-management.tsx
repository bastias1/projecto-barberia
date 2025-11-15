"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Loader2, KeyRound, Users, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

interface Barber {
  id: string;
  nombre: string;
  apellido: string | null;
  especialidad: string | null;
  usuario: {
    correo: string;
    rol: string;
  } | null;
}

export function UserManagement() {
  const [loading, setLoading] = useState(false);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loadingBarbers, setLoadingBarbers] = useState(true);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    nombre: "",
    apellido: "",
    telefono: "",
    rol: "barbero",
    especialidad: "",
  });

  useEffect(() => {
    fetchBarbers();
  }, []);

  const fetchBarbers = async () => {
    setLoadingBarbers(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("usuario")
        .select(`
          id,
          nombre,
          apellido,
          correo,
          rol,
          barbero:barbero(especialidad)
        `)
        .in('rol', ['admin', 'owner', 'barbero'])
        .order("nombre", { ascending: true });

      if (error) {
        console.error("Error fetching users:", error);
        toast.error("Error al cargar usuarios");
        return;
      }

      // Transform data to match Barber type
      const transformedData = (data || []).map((user: any) => ({
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        especialidad: Array.isArray(user.barbero) && user.barbero.length > 0 
          ? user.barbero[0].especialidad 
          : null,
        usuario: {
          correo: user.correo,
          rol: user.rol
        }
      }));

      setBarbers(transformedData);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoadingBarbers(false);
    }
  };

  const handleResetPassword = async (barberId: string, email: string, nombre: string) => {
    setResettingPassword(barberId);
    try {
      const supabase = createClient();
      
      // Call edge function to reset password
      const { data, error } = await supabase.functions.invoke('reset-barber-password', {
        body: {
          barberId,
          email,
          nombre
        }
      });

      console.log("Edge function response:", { data, error });

      if (error) {
        console.error("Error calling edge function:", error);
        toast.error(error.message || 'Error al llamar la función');
        return;
      }

      if (data?.error) {
        console.error("Edge function returned error:", data.error);
        toast.error(data.error);
        return;
      }

      toast.success(`Contraseña reseteada. Se envió un correo a ${email}`);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast.error(error?.message || "Error al resetear contraseña");
    } finally {
      setResettingPassword(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmed = window.confirm(`¿Estás seguro que deseas eliminar a ${userName}?`);
    
    if (!confirmed) return;

    setDeletingUser(userId);
    try {
      const supabase = createClient();

      // Delete from barbero table first (if exists)
      const { error: barberoError } = await supabase
        .from("barbero")
        .delete()
        .eq("id", userId);

      if (barberoError && barberoError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error("Error deleting barbero:", barberoError);
        toast.error("Error al eliminar perfil de barbero");
        return;
      }

      // Delete from usuario table
      const { error: usuarioError } = await supabase
        .from("usuario")
        .delete()
        .eq("id", userId);

      if (usuarioError) {
        console.error("Error deleting usuario:", usuarioError);
        toast.error("Error al eliminar usuario");
        return;
      }

      toast.success("Usuario eliminado exitosamente");
      fetchBarbers(); // Refresh list
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Error al eliminar usuario");
    } finally {
      setDeletingUser(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();

      // Step 1: Create user via API route (uses service role)
      const createResponse = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          nombre: formData.nombre,
          apellido: formData.apellido,
          telefono: formData.telefono || null,
          rol: formData.rol,
          especialidad: formData.especialidad || null,
        })
      });

      const createData = await createResponse.json();
      console.log("Create user response:", { status: createResponse.status, createData });

      if (!createResponse.ok) {
        console.error("Create user error:", createData);
        toast.error(createData.error || 'Error al crear usuario');
        return;
      }

      const userId = createData.userId;

      // Step 2: Call edge function to set password and send email
      const session = await supabase.auth.getSession();
      const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`
        },
        body: JSON.stringify({
          userId,
          email: formData.email,
          nombre: formData.nombre,
          apellido: formData.apellido,
          rol: formData.rol,
          especialidad: formData.especialidad || null,
        })
      });

      const emailData = await emailResponse.json();
      console.log("Edge function response:", { status: emailResponse.status, emailData });

      if (!emailResponse.ok) {
        console.error("Edge function error:", emailData);
        toast.warning(`Usuario creado, pero hubo un error al enviar el correo: ${emailData.error || 'Error desconocido'}`);
      } else {
        toast.success(`Usuario creado. Se envió un correo a ${formData.email} con la contraseña`);
      }
      
      // Refresh barber list and close form
      fetchBarbers();
      setShowCreateForm(false);
      
      // Reset form
      setFormData({
        email: "",
        nombre: "",
        apellido: "",
        telefono: "",
        rol: "barbero",
        especialidad: "",
      });
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error?.message || "Error inesperado al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* User List Card */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Lista de Usuarios
              </CardTitle>
              <CardDescription>
                Gestiona administradores, owners y barberos
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateForm(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Crear Usuario
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBarbers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          ) : barbers.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
              No hay usuarios registrados
            </div>
          ) : (
            <div className="space-y-3">
              {barbers.map((barber) => (
                <div
                  key={barber.id}
                  className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {barber.nombre} {barber.apellido}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {barber.usuario?.correo}
                    </p>
                    {barber.especialidad && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                        {barber.especialidad}
                      </p>
                    )}
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 capitalize">
                      Rol: {barber.usuario?.rol}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetPassword(barber.id, barber.usuario?.correo || '', barber.nombre)}
                      disabled={resettingPassword === barber.id}
                    >
                      {resettingPassword === barber.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Reseteando...
                        </>
                      ) : (
                        <>
                          <KeyRound className="mr-2 h-4 w-4" />
                          Resetear Contraseña
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteUser(barber.id, `${barber.nombre} ${barber.apellido}`)}
                      disabled={deletingUser === barber.id}
                    >
                      {deletingUser === barber.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Eliminando...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Modal/Form */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Crear Nuevo Usuario
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCreateForm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Completa el formulario para crear una nueva cuenta de barbero
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="apellido">Apellido *</Label>
                    <Input
                      id="apellido"
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Correo Electrónico *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      type="tel"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rol">Rol *</Label>
                    <Select
                      value={formData.rol}
                      onValueChange={(value) => setFormData({ ...formData, rol: value })}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="barbero">Barbero</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="owner">Propietario</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="especialidad">Especialidad</Label>
                    <Input
                      id="especialidad"
                      value={formData.especialidad}
                      onChange={(e) => setFormData({ ...formData, especialidad: e.target.value })}
                      placeholder="Ej: Cortes modernos, Barbas, etc."
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creando usuario...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Crear Usuario
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
