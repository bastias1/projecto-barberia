import { createClient } from "@/utils/supabase/client";

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
    activo?: boolean;
}

// Get all products (for dashboard - includes archived)
export async function getProducts(query?: string): Promise<Product[]> {
    const supabase = createClient();

    let queryBuilder = supabase
        .from('productos')
        .select('*')
        .order('created_at', { ascending: false });

    if (query) {
        queryBuilder = queryBuilder.ilike('nombre', `%${query}%`);
    }

    const { data, error } = await queryBuilder;

    if (error) {
        console.error('Error fetching products:', error);
        return [];
    }

    return data || [];
}

// Get only active products (for store/public pages)
export async function getActiveProducts(query?: string): Promise<Product[]> {
    const supabase = createClient();

    let queryBuilder = supabase
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('created_at', { ascending: false });

    if (query) {
        queryBuilder = queryBuilder.ilike('nombre', `%${query}%`);
    }

    const { data, error } = await queryBuilder;

    if (error) {
        console.error('Error fetching active products:', error);
        return [];
    }

    return data || [];
}

export async function getProductById(id: number): Promise<Product | null> {
    const supabase = createClient();

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

export async function createProduct(product: Omit<Product, 'id' | 'created_at'>): Promise<Product | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('productos')
        .insert(product)
        .select()
        .single();

    if (error) {
        console.error('Error creating product:', error);
        throw error;
    }

    return data;
}

export async function updateProduct(id: number, updates: Partial<Product>): Promise<Product | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('productos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating product:', error);
        throw error;
    }

    return data;
}

export async function deleteProduct(id: number): Promise<boolean> {
    const supabase = createClient();

    // First check if product exists and can be accessed
    const { data: product, error: fetchError } = await supabase
        .from('productos')
        .select('id')
        .eq('id', id)
        .single();

    if (fetchError) {
        console.error('Error fetching product for deletion:', fetchError.message, fetchError.code);
        throw new Error(`No se pudo encontrar el producto: ${fetchError.message}`);
    }

    const { error, count } = await supabase
        .from('productos')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting product:', error.message, error.code, error.details, error.hint);
        
        // Check for foreign key constraint violation
        if (error.code === '23503') {
            throw new Error('No se puede eliminar el producto porque tiene ventas o reseñas asociadas');
        }
        
        // Check for RLS policy violation
        if (error.code === '42501' || error.message?.includes('policy')) {
            throw new Error('No tienes permisos para eliminar productos');
        }
        
        throw new Error(error.message || 'Error al eliminar el producto');
    }

    return true;
}

// Archive product (soft delete - keeps sales history)
export async function archiveProduct(id: number): Promise<Product | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('productos')
        .update({ activo: false })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error archiving product:', error.message);
        throw new Error('Error al archivar el producto');
    }

    return data;
}

// Restore archived product
export async function restoreProduct(id: number): Promise<Product | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('productos')
        .update({ activo: true })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error restoring product:', error.message);
        throw new Error('Error al restaurar el producto');
    }

    return data;
}

export async function uploadProductImage(file: File): Promise<string | null> {
    const supabase = createClient();

    // Create a unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `productos/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('imgs')
        .upload(filePath, file);

    if (uploadError) {
        console.error('Error uploading image:', uploadError);
        throw uploadError;
    }

    const { data } = supabase.storage
        .from('imgs')
        .getPublicUrl(filePath);

    return data.publicUrl;
}
