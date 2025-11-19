import { createClient } from "@/utils/supabase/server";

export interface Product {
    id: number;
    nombre: string;
    descripcion: string | null;
    precio: number;
    imagen_url: string | null;
    categoria: string;
    stock: number;
    created_at: string;
    rating?: number;
    tag?: string;
}

export async function getProducts(): Promise<Product[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching products:', error);
        return [];
    }

    return data || [];
}

export async function getProductById(id: number): Promise<Product | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error(`Error fetching product ${id}:`, error);
        return null;
    }

    return data;
}
