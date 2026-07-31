"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, Plus, Trash2 } from "lucide-react";
import { RequireStaff } from "@/components/auth/route-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api-client";
import { productsApi } from "@/lib/api/products";
import { formatUzs } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProductsPage() {
  return (
    <RequireStaff roles={["SUPER_ADMIN"]}>
      <ProductsPageContent />
    </RequireStaff>
  );
}

function ProductsPageContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  function loadProducts() {
    productsApi
      .list()
      .then(setProducts)
      .finally(() => setIsLoading(false));
  }

  useEffect(loadProducts, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await productsApi.create({
        name,
        category: category || undefined,
        unitPrice: Number(unitPrice),
        stockQty: Number(stockQty) || 0,
      });
      toast.success("Mahsulot qo'shildi");
      setOpen(false);
      setName("");
      setCategory("");
      setUnitPrice("");
      setStockQty("0");
      loadProducts();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Mahsulot qo'shib bo'lmadi"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    setDeactivatingId(id);
    try {
      await productsApi.deactivate(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setDeactivatingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Mahsulotlar katalogi</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus />
              Mahsulot qo&apos;shish
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Mahsulot qo&apos;shish</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="p-name">Nomi</Label>
                  <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-category">Toifa (ixtiyoriy)</Label>
                  <Input
                    id="p-category"
                    placeholder="SHINA, ELEKTRONIKA…"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="p-price">Narxi (UZS)</Label>
                    <Input
                      id="p-price"
                      type="number"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-stock">Ombordagi soni</Label>
                    <Input
                      id="p-stock"
                      type="number"
                      value={stockQty}
                      onChange={(e) => setStockQty(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="animate-spin" />}
                  Mahsulot qo&apos;shish
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Hozircha mahsulotlar yo&apos;q.</p>
      ) : (
        <ul className="space-y-2">
          {products.map((product) => (
            <li key={product.id}>
              <Card>
                <CardContent className="flex items-center gap-3 py-2">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Package className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatUzs(product.unitPrice)} · {product.stockQty} ta omborda
                    </p>
                  </div>
                  {product.category && <Badge variant="secondary">{product.category}</Badge>}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeactivate(product.id)}
                    disabled={deactivatingId === product.id}
                  >
                    {deactivatingId === product.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
