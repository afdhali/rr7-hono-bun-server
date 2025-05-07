// server/controllers/userController.ts
import type { Context } from "hono";
import { UserModel } from "../models/userModel";

export const UserController = {
  // Dapatkan semua users
  getAll: (c: Context) => {
    return c.json(UserModel.findAll());
  },

  // Dapatkan user berdasarkan ID
  getById: (c: Context) => {
    const id = parseInt(c.req.param("id"));
    const user = UserModel.findById(id);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json(user);
  },

  // Buat user baru
  create: async (c: Context) => {
    try {
      const body = await c.req.json();

      if (!body.name || !body.email) {
        return c.json({ error: "Name and email are required" }, 400);
      }

      const newUser = UserModel.create({
        name: body.name,
        email: body.email,
      });

      return c.json(newUser, 201);
    } catch (error) {
      return c.json({ error: "Invalid request body" }, 400);
    }
  },

  // Update user
  update: async (c: Context) => {
    try {
      const id = parseInt(c.req.param("id"));
      const body = await c.req.json();

      const updatedUser = UserModel.update(id, body);

      if (!updatedUser) {
        return c.json({ error: "User not found" }, 404);
      }

      return c.json(updatedUser);
    } catch (error) {
      return c.json({ error: "Invalid request body" }, 400);
    }
  },

  // Hapus user
  delete: (c: Context) => {
    const id = parseInt(c.req.param("id"));
    const deletedUser = UserModel.delete(id);

    if (!deletedUser) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({
      message: "User deleted successfully",
      user: deletedUser,
    });
  },
};
