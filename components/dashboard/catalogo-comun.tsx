"use client";

import type { ReactNode } from "react";
import { Archive, Package, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Piezas que comparten los catálogos del dashboard (Productos y Servicios). */

export function StatCard({ titulo, valor, nota, className }: { titulo: string; valor: ReactNode; nota: string; className?: string }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">{titulo}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className={`text-3xl font-bold ${className ?? ""}`}>{valor}</div>
                <p className="text-xs text-muted-foreground mt-1">{nota}</p>
            </CardContent>
        </Card>
    );
}

export function SinResultados({ icono: Icono = Package, texto }: { icono?: typeof Package; texto: string }) {
    return (
        <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Icono className="h-6 w-6 text-muted-foreground" />
            </div>
            <p>{texto}</p>
        </div>
    );
}

interface AccionesCatalogoProps {
    /** "producto" | "servicio": entra en los títulos de los botones */
    tipo: string;
    archivado: boolean;
    onArchivar: () => void;
    onRestaurar: () => void;
    onEliminar: () => void;
    /** Texto de la confirmación de eliminar */
    confirmacion: ReactNode;
}

/** Restaurar/archivar + eliminar con confirmación, para la fila de un elemento del catálogo. */
export function AccionesCatalogo({ tipo, archivado, onArchivar, onRestaurar, onEliminar, confirmacion }: AccionesCatalogoProps) {
    return (
        <>
            {archivado ? (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                    onClick={onRestaurar}
                    title={`Restaurar ${tipo}`}
                >
                    <RotateCcw className="h-4 w-4" />
                </Button>
            ) : (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                    onClick={onArchivar}
                    title={`Archivar ${tipo}`}
                >
                    <Archive className="h-4 w-4" />
                </Button>
            )}
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>{confirmacion}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={onEliminar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

interface NoSePuedeEliminarProps {
    tipo: string;
    /** Elemento que no se pudo eliminar; null = cerrado */
    nombre: string | undefined;
    /** "ventas o reseñas", "reservas"… */
    motivo: string;
    /** "historial de ventas" */
    historial: string;
    /** "la tienda" */
    dondeSale: string;
    /** "Mantendrá el historial de citas" */
    mantiene: string;
    onArchivar: () => void;
    onCerrar: () => void;
}

/** Cuando la BD impide eliminar por registros asociados: ofrece archivar. */
export function NoSePuedeEliminarDialog({ tipo, nombre, motivo, historial, dondeSale, mantiene, onArchivar, onCerrar }: NoSePuedeEliminarProps) {
    return (
        <AlertDialog open={nombre !== undefined} onOpenChange={(open) => !open && onCerrar()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <Archive className="h-5 w-5 text-orange-500" />
                        No se puede eliminar
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3">
                            <span className="block">
                                El {tipo} <b>{nombre}</b> no se puede eliminar porque tiene {motivo} asociadas.
                            </span>
                            <span className="block">
                                Para mantener el {historial}, te recomendamos <strong>archivar</strong> el {tipo} en su lugar. El {tipo} archivado:
                            </span>
                            <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                                <li>No aparecerá en {dondeSale}</li>
                                <li>{mantiene}</li>
                                <li>Podrás restaurarlo en cualquier momento</li>
                            </ul>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onArchivar} className="bg-orange-600 text-white hover:bg-orange-700">
                        <Archive className="h-4 w-4 mr-2" />
                        Archivar {tipo}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
