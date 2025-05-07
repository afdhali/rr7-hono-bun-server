// app/server/models/productModel.ts
export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

// Data awal sebagai "database" sederhana
export const products: Product[] = [
  { id: 1, name: "Product 1", price: 100, stock: 50 },
  { id: 2, name: "Product 2", price: 200, stock: 30 },
  { id: 3, name: "Product 3", price: 150, stock: 75 },
];

// Model methods untuk Product
export const ProductModel = {
  findAll: () => products,

  findById: (id: number) => products.find((p) => p.id === id),

  create: (productData: Omit<Product, "id">) => {
    const newProduct = {
      id: products.length + 1,
      ...productData,
    };
    products.push(newProduct);
    return newProduct;
  },

  update: (id: number, productData: Partial<Omit<Product, "id">>) => {
    const productIndex = products.findIndex((p) => p.id === id);
    if (productIndex === -1) return null;

    const updatedProduct = {
      ...products[productIndex],
      ...productData,
      id, // Pastikan ID tetap sama
    };
    products[productIndex] = updatedProduct;
    return updatedProduct;
  },

  delete: (id: number) => {
    const productIndex = products.findIndex((p) => p.id === id);
    if (productIndex === -1) return null;

    const deletedProduct = products[productIndex];
    products.splice(productIndex, 1);
    return deletedProduct;
  },
};
