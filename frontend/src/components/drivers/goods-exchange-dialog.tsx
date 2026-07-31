"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-client";
import { ledgerApi } from "@/lib/api/ledger";
import { productsApi } from "@/lib/api/products";
import { formatUzs } from "@/lib/format";
import type { Product } from "@/lib/types";

export function GoodsExchangeDialog({
  driverId,
  onSuccess,
}: {
  driverId: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      productsApi.list().then(setProducts).catch(() => undefined);
    }
  }, [open]);

  const selectedProduct = products.find((p) => p.id === productId);
  const totalCost = selectedProduct
    ? parseFloat(selectedProduct.unitPrice) * (Number(quantity) || 0)
    : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) {
      toast.error("Mahsulotni tanlang");
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      toast.error("To'g'ri miqdorni kiriting");
      return;
    }
    setIsSubmitting(true);
    try {
      await ledgerApi.exchangeGoods(driverId, productId, qty);
      toast.success("Mahsulot almashinuvi qayd etildi");
      setOpen(false);
      setProductId("");
      setQuantity("1");
      onSuccess();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Almashinuvni qayd etib bo'lmadi"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex-1">Mahsulotga almashtirish</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Mahsulotga almashtirish</DialogTitle>
            <DialogDescription>
              Haydovchi balansidan mahsulot narxi yechiladi va ombordagi soni kamayadi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Mahsulot</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Mahsulotni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} — {formatUzs(product.unitPrice)} ({product.stockQty} ta
                      omborda)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exchange-qty">Miqdor</Label>
              <Input
                id="exchange-qty"
                type="number"
                inputMode="numeric"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            {selectedProduct && (
              <p className="text-sm text-muted-foreground">
                Jami: <span className="font-medium text-foreground">{formatUzs(totalCost)}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="animate-spin" />}
              Almashtirishni tasdiqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
