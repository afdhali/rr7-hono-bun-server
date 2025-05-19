// app/server/controllers/todo.controller.ts (updated with zodErrors utility)
import { type Context } from "hono";
import { eq, and, desc, asc, isNull, like, or } from "drizzle-orm";
import { z } from "zod";

import { createZodErrorResponse } from "../utils/zodErrors";
import { db } from "~/db";
import { todos, type Todo } from "~/db/schema";

// Validasi schema untuk create todo
const createTodoSchema = z.object({
  title: z
    .string()
    .min(1, "Judul harus diisi")
    .max(255, "Judul terlalu panjang"),
  description: z.string().optional(),
  priority: z.number().int().min(0).max(10).optional(),
  dueDate: z.string().datetime().optional(),
});

// Validasi schema untuk update todo
const updateTodoSchema = z.object({
  title: z
    .string()
    .min(1, "Judul harus diisi")
    .max(255, "Judul terlalu panjang")
    .optional(),
  description: z.string().optional(),
  completed: z.boolean().optional(),
  priority: z.number().int().min(0).max(10).optional(),
  dueDate: z.string().datetime().optional().nullable(),
});

// Validasi schema untuk filter todos
const filterTodosSchema = z.object({
  status: z.enum(["all", "active", "completed"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["title", "priority", "dueDate", "createdAt"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
});

export class TodoController {
  /**
   * Get todos for current user with filtering and sorting
   * Requires authentication
   */
  static async getTodos(c: Context): Promise<{
    success: boolean;
    todos?: Todo[];
    message?: string;
    status?: number;
    errors?: Record<string, string[]>;
  }> {
    try {
      // Check if user is authenticated
      const user = c.var.user;

      if (!user) {
        return {
          success: false,
          message: "Authentication required",
          status: 401,
        };
      }

      // Get query parameters for filtering and sorting
      const status = c.req.query("status") || "all";
      const search = c.req.query("search") || "";
      const sortBy = c.req.query("sortBy") || "createdAt";
      const sortDirection = c.req.query("sortDirection") || "desc";

      // Validate query parameters
      const validationResult = filterTodosSchema.safeParse({
        status,
        search,
        sortBy,
        sortDirection,
      });

      if (!validationResult.success) {
        return createZodErrorResponse(validationResult.error);
      }

      // Build the query with all conditions
      const whereConditions = [];

      // User filter is always applied
      whereConditions.push(eq(todos.userId, user.id));

      // Apply status filter
      if (status === "active") {
        whereConditions.push(eq(todos.completed, false));
      } else if (status === "completed") {
        whereConditions.push(eq(todos.completed, true));
      }

      // Apply search filter
      if (search) {
        whereConditions.push(
          or(
            like(todos.title, `%${search}%`),
            like(todos.description || "", `%${search}%`)
          )
        );
      }

      // Define the order by expressions based on sortBy and sortDirection
      let orderByExpressions = [];

      if (sortBy === "title") {
        orderByExpressions.push(
          sortDirection === "asc" ? asc(todos.title) : desc(todos.title)
        );
      } else if (sortBy === "priority") {
        orderByExpressions.push(
          sortDirection === "asc" ? asc(todos.priority) : desc(todos.priority)
        );
      } else if (sortBy === "dueDate") {
        // Put null dates at the end regardless of sort direction
        orderByExpressions.push(isNull(todos.dueDate));
        orderByExpressions.push(
          sortDirection === "asc" ? asc(todos.dueDate) : desc(todos.dueDate)
        );
      } else {
        // Default sort by createdAt
        orderByExpressions.push(
          sortDirection === "asc" ? asc(todos.createdAt) : desc(todos.createdAt)
        );
      }

      // Execute the query with all conditions and sorting at once
      const userTodos = await db
        .select()
        .from(todos)
        .$dynamic() // Use $dynamic to build the query
        .where(and(...whereConditions))
        .orderBy(...orderByExpressions);

      return {
        success: true,
        todos: userTodos,
      };
    } catch (error) {
      console.error("Error getting todos:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to get todos",
        status: 500,
      };
    }
  }

  /**
   * Get a single todo by ID
   * Requires authentication and todo ownership
   */
  static async getTodo(c: Context): Promise<{
    success: boolean;
    todo?: Todo;
    message?: string;
    status?: number;
  }> {
    try {
      // Check if user is authenticated
      const user = c.var.user;

      if (!user) {
        return {
          success: false,
          message: "Authentication required",
          status: 401,
        };
      }

      // Get todo ID from params
      const todoId = parseInt(c.req.param("id"));

      if (isNaN(todoId)) {
        return {
          success: false,
          message: "Invalid todo ID",
          status: 400,
        };
      }

      // Find todo and check ownership
      const todo = await db.query.todos.findFirst({
        where: and(eq(todos.id, todoId), eq(todos.userId, user.id)),
      });

      if (!todo) {
        return {
          success: false,
          message: "Todo not found or you don't have permission to access it",
          status: 404,
        };
      }

      return {
        success: true,
        todo,
      };
    } catch (error) {
      console.error("Error getting todo:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to get todo",
        status: 500,
      };
    }
  }

  /**
   * Create a new todo for current user
   * Requires authentication
   */
  static async createTodo(c: Context): Promise<{
    success: boolean;
    todo?: Todo;
    message?: string;
    errors?: Record<string, string[]>;
    status?: number;
  }> {
    try {
      // Check if user is authenticated
      const user = c.var.user;

      if (!user) {
        console.error("Authentication required: User not found in context");
        return {
          success: false,
          message: "Authentication required",
          status: 401,
        };
      }

      // Get todo data from request
      const body = await c.req.json();
      console.log("Received todo data:", body);

      // Validate input
      const validationResult = createTodoSchema.safeParse(body);

      if (!validationResult.success) {
        return createZodErrorResponse(validationResult.error);
      }

      const validatedData = validationResult.data;
      console.log("Validated data:", validatedData);

      // Create new todo
      const [newTodo] = await db
        .insert(todos)
        .values({
          userId: user.id,
          title: validatedData.title,
          description: validatedData.description || null,
          priority:
            validatedData.priority !== undefined ? validatedData.priority : 0,
          dueDate: validatedData.dueDate
            ? new Date(validatedData.dueDate)
            : null,
          completed: false,
        })
        .returning();

      console.log("Created todo:", newTodo);

      return {
        success: true,
        todo: newTodo,
        message: "Todo created successfully",
      };
    } catch (error) {
      console.error("Error creating todo:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create todo",
        status: 500,
      };
    }
  }

  /**
   * Update a todo
   * Requires authentication and todo ownership
   */
  static async updateTodo(c: Context): Promise<{
    success: boolean;
    todo?: Todo;
    message?: string;
    errors?: Record<string, string[]>;
    status?: number;
  }> {
    try {
      // Check if user is authenticated
      const user = c.var.user;

      if (!user) {
        return {
          success: false,
          message: "Authentication required",
          status: 401,
        };
      }

      // Get todo ID from params
      const todoId = parseInt(c.req.param("id"));

      if (isNaN(todoId)) {
        return {
          success: false,
          message: "Invalid todo ID",
          status: 400,
        };
      }

      // Get todo data from request
      const body = await c.req.json();

      // Validate input
      const validationResult = updateTodoSchema.safeParse(body);

      if (!validationResult.success) {
        return createZodErrorResponse(validationResult.error);
      }

      const validatedData = validationResult.data;

      // Find todo and check ownership
      const existingTodo = await db.query.todos.findFirst({
        where: eq(todos.id, todoId),
      });

      if (!existingTodo) {
        return {
          success: false,
          message: "Todo not found",
          status: 404,
        };
      }

      // Check if user owns this todo
      if (existingTodo.userId !== user.id) {
        return {
          success: false,
          message: "You don't have permission to update this todo",
          status: 403,
        };
      }

      // Prepare update data
      const updateData: Partial<Todo> = {};

      if (validatedData.title !== undefined) {
        updateData.title = validatedData.title;
      }

      if (validatedData.description !== undefined) {
        updateData.description = validatedData.description;
      }

      if (validatedData.completed !== undefined) {
        updateData.completed = validatedData.completed;
      }

      if (validatedData.priority !== undefined) {
        updateData.priority = validatedData.priority;
      }

      if (validatedData.dueDate !== undefined) {
        updateData.dueDate = validatedData.dueDate
          ? new Date(validatedData.dueDate)
          : null;
      }

      // Update todo
      const [updatedTodo] = await db
        .update(todos)
        .set(updateData)
        .where(eq(todos.id, todoId))
        .returning();

      return {
        success: true,
        todo: updatedTodo,
        message: "Todo updated successfully",
      };
    } catch (error) {
      console.error("Error updating todo:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to update todo",
        status: 500,
      };
    }
  }

  /**
   * Toggle todo completed status
   * Requires authentication and todo ownership
   */
  static async toggleTodo(c: Context): Promise<{
    success: boolean;
    todo?: Todo;
    message?: string;
    status?: number;
  }> {
    try {
      // Check if user is authenticated
      const user = c.var.user;

      if (!user) {
        return {
          success: false,
          message: "Authentication required",
          status: 401,
        };
      }

      // Get todo ID from params
      const todoId = parseInt(c.req.param("id"));

      if (isNaN(todoId)) {
        return {
          success: false,
          message: "Invalid todo ID",
          status: 400,
        };
      }

      // Find todo and check ownership
      const existingTodo = await db.query.todos.findFirst({
        where: eq(todos.id, todoId),
      });

      if (!existingTodo) {
        return {
          success: false,
          message: "Todo not found",
          status: 404,
        };
      }

      // Check if user owns this todo
      if (existingTodo.userId !== user.id) {
        return {
          success: false,
          message: "You don't have permission to update this todo",
          status: 403,
        };
      }

      // Toggle completed status
      const [updatedTodo] = await db
        .update(todos)
        .set({ completed: !existingTodo.completed })
        .where(eq(todos.id, todoId))
        .returning();

      return {
        success: true,
        todo: updatedTodo,
        message: `Todo marked as ${
          updatedTodo.completed ? "completed" : "incomplete"
        }`,
      };
    } catch (error) {
      console.error("Error toggling todo:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to toggle todo",
        status: 500,
      };
    }
  }

  /**
   * Delete a todo
   * Requires authentication and todo ownership
   */
  static async deleteTodo(c: Context): Promise<{
    success: boolean;
    message?: string;
    status?: number;
  }> {
    try {
      // Check if user is authenticated
      const user = c.var.user;

      if (!user) {
        return {
          success: false,
          message: "Authentication required",
          status: 401,
        };
      }

      // Get todo ID from params
      const todoId = parseInt(c.req.param("id"));

      if (isNaN(todoId)) {
        return {
          success: false,
          message: "Invalid todo ID",
          status: 400,
        };
      }

      // Find todo and check ownership
      const existingTodo = await db.query.todos.findFirst({
        where: eq(todos.id, todoId),
      });

      if (!existingTodo) {
        return {
          success: false,
          message: "Todo not found",
          status: 404,
        };
      }

      // Check if user owns this todo
      if (existingTodo.userId !== user.id) {
        return {
          success: false,
          message: "You don't have permission to delete this todo",
          status: 403,
        };
      }

      // Delete todo
      await db.delete(todos).where(eq(todos.id, todoId));

      return {
        success: true,
        message: "Todo deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting todo:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to delete todo",
        status: 500,
      };
    }
  }

  /**
   * Clear all completed todos
   * Requires authentication
   */
  static async clearCompletedTodos(c: Context): Promise<{
    success: boolean;
    count?: number;
    message?: string;
    status?: number;
  }> {
    try {
      // Check if user is authenticated
      const user = c.var.user;

      if (!user) {
        return {
          success: false,
          message: "Authentication required",
          status: 401,
        };
      }

      // Delete all completed todos for this user
      const result = await db
        .delete(todos)
        .where(and(eq(todos.userId, user.id), eq(todos.completed, true)))
        .returning();

      return {
        success: true,
        count: result.length,
        message: `${result.length} completed todo(s) deleted`,
      };
    } catch (error) {
      console.error("Error clearing completed todos:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to clear completed todos",
        status: 500,
      };
    }
  }
}
