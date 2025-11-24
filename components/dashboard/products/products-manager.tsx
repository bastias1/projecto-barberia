"use client";

import { useState, useEffect, useRef } from "react";
import { Product, getProducts, createProduct, updateProduct, deleteProduct, uploadProductImage } from "@/lib/services/product-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Loader2, Search, Package, Edit, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import { DashboardTableSkeleton } from "@/components/dashboard/loading-skeletons";

export function ProductsManager() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Form state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        nombre: "",
        descripcion: "",
        precio: "",
        categoria: "",
        stock: "",
        tag: ""
    });

    useEffect(() => {
        loadProducts();
    }, []);

    async function loadProducts() {
        try {
            setLoading(true);
            const data = await getProducts();
            setProducts(data);
        } catch (error) {
            console.error("Error loading products:", error);
            toast.error("Error al cargar los productos");
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setFormData({
            nombre: "",
            descripcion: "",
            precio: "",
            categoria: "",
            stock: "",
            tag: ""
        });
        setImageFile(null);
        setImagePreview(null);
        setEditingProduct(null);
    }

    function handleOpenDialog(product?: Product) {
        if (product) {
            setEditingProduct(product);
            setFormData({
                nombre: product.nombre,
                descripcion: product.descripcion || "",
                precio: product.precio.toString(),
                categoria: product.categoria,
                stock: product.stock.toString(),
                tag: product.tag || ""
            });
            setImagePreview(product.imagen_url);
        } else {
            resetForm();
        }
        setIsDialogOpen(true);
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.nombre || !formData.precio || !formData.categoria) {
            toast.error("Por favor completa los campos obligatorios");
            return;
        }

        try {
            setIsSaving(true);
            let imageUrl = editingProduct?.imagen_url || null;

            if (imageFile) {
                imageUrl = await uploadProductImage(imageFile);
            }

            const productData = {
                nombre: formData.nombre,
                descripcion: formData.descripcion || null,
                precio: Number(formData.precio),
                categoria: formData.categoria,
                stock: Number(formData.stock) || 0,
                tag: formData.tag || undefined,
                imagen_url: imageUrl
            };

            if (editingProduct) {
                const updated = await updateProduct(editingProduct.id, productData);
                if (updated) {
                    setProducts(products.map(p => p.id === updated.id ? updated : p));
                    toast.success("Producto actualizado");
                }
            } else {
                const created = await createProduct(productData);
                if (created) {
                    setProducts([created, ...products]);
                    toast.success("Producto creado");
                }
            }
            setIsDialogOpen(false);
            resetForm();
        } catch (error) {
            console.error("Error saving product:", error);
            toast.error("Error al guardar el producto");
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDeleteProduct(id: number) {
        try {
            await deleteProduct(id);
            setProducts(products.filter(p => p.id !== id));
            toast.success("Producto eliminado");
        } catch (error) {
            console.error("Error deleting product:", error);
            toast.error("Error al eliminar el producto");
        }
    }

    const filteredProducts = products.filter(product =>
        product.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.categoria.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return <DashboardTableSkeleton />;
    }


    return (
        <div className="space-y-6">
            {/* Header Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium">Total Productos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{products.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">En el catálogo</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium">Valor Inventario</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            ${products.reduce((acc, p) => acc + (p.precio * p.stock), 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Estimado</p>
                    </CardContent>
                </Card>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar producto..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => handleOpenDialog()}>
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Producto
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{editingProduct ? "Editar Producto" : "Crear Nuevo Producto"}</DialogTitle>
                            <DialogDescription>
                                {editingProduct ? "Modifica los detalles del producto." : "Agrega un nuevo producto al inventario."}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Nombre *</Label>
                                        <Input
                                            id="name"
                                            placeholder="Ej. Cera Mate"
                                            value={formData.nombre}
                                            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="category">Categoría *</Label>
                                        <Select
                                            value={formData.categoria}
                                            onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona una categoría" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Cuidado Capilar">Cuidado Capilar</SelectItem>
                                                <SelectItem value="Accesorios">Accesorios</SelectItem>
                                                <SelectItem value="Barba">Barba</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="price">Precio ($) *</Label>
                                            <Input
                                                id="price"
                                                type="number"
                                                placeholder="0"
                                                value={formData.precio}
                                                onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="stock">Stock</Label>
                                            <Input
                                                id="stock"
                                                type="number"
                                                placeholder="0"
                                                value={formData.stock}
                                                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="tag">Etiqueta (Opcional)</Label>
                                        <Input
                                            id="tag"
                                            placeholder="Ej. Nuevo, Oferta"
                                            value={formData.tag}
                                            onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Imagen del Producto</Label>
                                        <div
                                            className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center h-48 cursor-pointer hover:bg-muted/50 transition-colors relative overflow-hidden"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            {imagePreview ? (
                                                <Image
                                                    src={imagePreview}
                                                    alt="Preview"
                                                    fill
                                                    className="object-cover rounded-md"
                                                />
                                            ) : (
                                                <>
                                                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                                    <span className="text-sm text-muted-foreground">Click para subir imagen</span>
                                                </>
                                            )}
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Descripción</Label>
                                        <Textarea
                                            id="description"
                                            placeholder="Descripción detallada del producto..."
                                            className="h-32"
                                            value={formData.descripcion}
                                            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={isSaving} className="w-full">
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    {editingProduct ? "Guardar Cambios" : "Crear Producto"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Products List */}
            <Card>
                <CardContent className="p-0">
                    <div className="rounded-md border">
                        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/50 font-medium text-sm text-muted-foreground">
                            <div className="col-span-2 sm:col-span-1">Imagen</div>
                            <div className="col-span-4 sm:col-span-4">Nombre</div>
                            <div className="col-span-2 sm:col-span-2">Categoría</div>
                            <div className="col-span-2 sm:col-span-2">Precio</div>
                            <div className="col-span-2 sm:col-span-1">Stock</div>
                            <div className="hidden sm:block sm:col-span-2 text-right">Acciones</div>
                        </div>
                        <div className="divide-y">
                            {filteredProducts.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                        <Package className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <p>No se encontraron productos.</p>
                                </div>
                            ) : (
                                filteredProducts.map((product) => (
                                    <div key={product.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/50 transition-colors group">
                                        <div className="col-span-2 sm:col-span-1 relative h-10 w-10 rounded-md overflow-hidden bg-muted">
                                            {product.imagen_url ? (
                                                <Image
                                                    src={product.imagen_url}
                                                    alt={product.nombre}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full">
                                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-4 sm:col-span-4 text-sm font-medium">
                                            {product.nombre}
                                        </div>
                                        <div className="col-span-2 sm:col-span-2 text-sm text-muted-foreground">
                                            {product.categoria}
                                        </div>
                                        <div className="col-span-2 sm:col-span-2 text-sm font-medium">
                                            ${product.precio.toLocaleString()}
                                        </div>
                                        <div className="col-span-2 sm:col-span-1 text-sm">
                                            <Badge variant={product.stock > 0 ? "secondary" : "destructive"}>
                                                {product.stock}
                                            </Badge>
                                        </div>
                                        <div className="col-span-12 sm:col-span-2 flex justify-end gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleOpenDialog(product)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta acción no se puede deshacer. Esto eliminará permanentemente el producto <b>{product.nombre}</b> de tu inventario.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDeleteProduct(product.id)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            Eliminar
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
