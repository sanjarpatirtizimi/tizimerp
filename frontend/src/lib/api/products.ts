import { apiClient } from "../api-client";
import type { Product } from "../types";

export interface CreateProductPayload {
  name: string;
  category?: string;
  unitPrice: number;
  stockQty?: number;
}

export const productsApi = {
  list: () => apiClient.get<Product[]>("/products").then((r) => r.data),
  get: (id: string) => apiClient.get<Product>(`/products/${id}`).then((r) => r.data),
  create: (payload: CreateProductPayload) =>
    apiClient.post<Product>("/products", payload).then((r) => r.data),
  deactivate: (id: string) =>
    apiClient.patch<Product>(`/products/${id}/deactivate`).then((r) => r.data),
};
