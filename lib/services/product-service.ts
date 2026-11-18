import { createClient } from "@/utils/supabase/client";

export interface Product {
    id: number;
    nombre: string;
    descripcion: string | null;
    precio: number;
    imagen_url: string | null;
    categoria: string;
    stock: number;
    stock_minimo?: number;
    created_at: string;
    rating?: number;
    tag?: string | null;
    activo?: boolean;
}

// Alias de columnas para mantener la forma que usa la UI
const PRODUCT_COLUMNS = "id:id_producto, nombre, descripcion, precio, imagen_url, categoria, stock, stock_minimo, created_at, tag, activo";

type ProductInput = Partial<Omit<Product, "id" | "created_at" | "rating">>;

// Solo columnas editables (evita enviar id, rating u otros campos calculados)
function toRow(product: ProductInput) {
    const { nombre, descripcion, precio, imagen_url, categoria, stock, stock_minimo, tag, activo } = product;
    return Object.fromEntries(
        Object.entries({ nombre, descripcion, precio, imagen_url, categoria, stock, stock_minimo, tag, activo })
            .filter(([, v]) => v !== undefined)
    );
}

// Get all products (for dashboard - includes archived)
export async function getProducts(idBarberia: string, query?: string): Promise<Product[]> {
    const supabase = createClient();

    let queryBuilder = supabase
        .from('producto')
        .select(PRODUCT_COLUMNS)
        .eq('id_barberia', idBarberia)
        .order('created_at', { ascending: false });

    if (query) {
        queryBuilder = queryBuilder.ilike('nombre', `%${query}%`);
    }

    const { data, error } = await queryBuilder;

    if (error) {
        console.error('Error fetching products:', error);
        return [];
    }

    return (data as Product[]) || [];
}

// Get only active products (for store/public pages)
export async function getActiveProducts(idBarberia: string, query?: string): Promise<Product[]> {
    const supabase = createClient();

    let queryBuilder = supabase
        .from('producto')
        .select(PRODUCT_COLUMNS)
        .eq('id_barberia', idBarberia)
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

    return (data as Product[]) || [];
}

export async function getProductById(idBarberia: string, id: number): Promise<Product | null> {
    const supabase = createClient();

    const [{ data, error }, { data: resenas }] = await Promise.all([
        supabase
            .from('producto')
            .select(PRODUCT_COLUMNS)
            .eq('id_barberia', idBarberia)
            .eq('id_producto', id)
            .maybeSingle(),
        supabase
            .from('resena')
            .select('calificacion')
            .eq('id_barberia', idBarberia)
            .eq('id_producto', id),
    ]);

    if (error) {
        console.error(`Error fetching product ${id}:`, error);
        return null;
    }

    // Return null if product is archived (for public-facing pages)
    if (!data || data.activo === false) {
        return null;
    }

    // Promedio de las reseñas reales del producto
    const product = data as Product;
    if (resenas && resenas.length > 0) {
        const promedio = resenas.reduce((acc, r) => acc + Number(r.calificacion), 0) / resenas.length;
        product.rating = Math.round(promedio * 10) / 10;
    }

    return product;
}

export async function createProduct(idBarberia: string, product: ProductInput): Promise<Product | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('producto')
        .insert({ ...toRow(product), id_barberia: idBarberia })
        .select(PRODUCT_COLUMNS)
        .single();

    if (error) {
        console.error('Error creating product:', error);
        throw error;
    }

    return data as Product;
}

export async function updateProduct(id: number, updates: ProductInput): Promise<Product | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('producto')
        .update(toRow(updates))
        .eq('id_producto', id)
        .select(PRODUCT_COLUMNS)
        .single();

    if (error) {
        console.error('Error updating product:', error);
        throw error;
    }

    return data as Product;
}

// HU-08: ingreso de stock (suma en la BD, no pisa ventas simultáneas). Devuelve el stock resultante
export async function ingresarStock(id: number, cantidad: number): Promise<number> {
    const { data, error } = await createClient().rpc('ingresar_stock', { p_id_producto: id, p_cantidad: cantidad });

    // Sin permiso (RLS) o cantidad inválida la función no actualiza nada y devuelve null
    if (error || data == null) {
        console.error('Error registering stock entry:', error);
        throw new Error('No se pudo registrar el ingreso');
    }

    return data as number;
}

export async function deleteProduct(id: number): Promise<boolean> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('producto')
        .delete()
        .eq('id_producto', id)
        .select('id_producto');

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

    // Con RLS, un DELETE sin permiso no falla: simplemente no borra filas
    if (!data || data.length === 0) {
        throw new Error('No tienes permisos para eliminar productos');
    }

    return true;
}

async function setProductActive(id: number, activo: boolean): Promise<Product | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('producto')
        .update({ activo })
        .eq('id_producto', id)
        .select(PRODUCT_COLUMNS)
        .single();

    if (error) {
        console.error(`Error ${activo ? 'restoring' : 'archiving'} product:`, error.message);
        throw new Error(activo ? 'Error al restaurar el producto' : 'Error al archivar el producto');
    }

    return data as Product;
}

// Archive product (soft delete - keeps sales history)
export async function archiveProduct(id: number): Promise<Product | null> {
    return setProductActive(id, false);
}

// Restore archived product
export async function restoreProduct(id: number): Promise<Product | null> {
    return setProductActive(id, true);
}

export async function uploadProductImage(idBarberia: string, file: File): Promise<string | null> {
    const supabase = createClient();

    // Create a unique file name (Storage solo deja escribir en la carpeta de la propia barbería)
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `productos/${idBarberia}/${fileName}`;

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
