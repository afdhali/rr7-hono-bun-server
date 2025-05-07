// app/server/controllers/productController.ts
// Gunakan Type Import untuk Context karena verbatimModuleSyntax
import type { Context } from "hono";
import { ProductModel } from "../models/productModel";

export const ProductController = {
  // Dapatkan semua products
  getAll: (c: Context) => {
    return c.json(ProductModel.findAll());
  },

  // Dapatkan product berdasarkan ID
  getById: (c: Context) => {
    const id = parseInt(c.req.param("id"));
    const product = ProductModel.findById(id);

    if (!product) {
      return c.json({ error: "Product not found" }, 404);
    }

    return c.json(product);
  },

  // Buat product baru
  create: async (c: Context) => {
    try {
      const body = await c.req.json();

      if (!body.name || body.price === undefined) {
        return c.json({ error: "Name and price are required" }, 400);
      }

      const newProduct = ProductModel.create({
        name: body.name,
        price: body.price,
        stock: body.stock || 0,
      });

      return c.json(newProduct, 201);
    } catch (error) {
      return c.json({ error: "Invalid request body" }, 400);
    }
  },

  // Update product
  update: async (c: Context) => {
    try {
      const id = parseInt(c.req.param("id"));
      const body = await c.req.json();

      const updatedProduct = ProductModel.update(id, body);

      if (!updatedProduct) {
        return c.json({ error: "Product not found" }, 404);
      }

      return c.json(updatedProduct);
    } catch (error) {
      return c.json({ error: "Invalid request body" }, 400);
    }
  },

  // Hapus product
  delete: (c: Context) => {
    const id = parseInt(c.req.param("id"));
    const deletedProduct = ProductModel.delete(id);

    if (!deletedProduct) {
      return c.json({ error: "Product not found" }, 404);
    }

    return c.json({
      message: "Product deleted successfully",
      product: deletedProduct,
    });
  },
};
