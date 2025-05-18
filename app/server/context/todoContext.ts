// app/server/context/todoContext.ts
import { type Context } from "hono";
import { TodoController } from "../controllers/todoController";
import { getCurrentUserController } from "../controllers/getCurrentUser.controller";

/**
 * Membuat adapter functions untuk Todo controllers
 * @param c Hono Context
 * @returns Object dengan fungsi-fungsi untuk manipulasi todo
 */
const createTodoContext = (c: Context) => {
  /**
   * Helper function untuk mendapatkan context dengan user
   * @returns Context dengan user
   */
  const getUserContext = async (options?: any) => {
    // Dapatkan user secara langsung
    const user = await getCurrentUserController.getUser(c);

    if (!user) {
      console.log("[todoContext] No user found");
      return null;
    }

    console.log("[todoContext] Found user:", user.email);

    // Buat context baru dengan user
    const mockContext = {
      ...c,
      var: {
        ...c.var,
        user: {
          ...user,
          passwordHash: "", // Tambahkan passwordHash kosong
        },
      },
    } as unknown as Context;

    // Jika ada opsi untuk query params (untuk getTodos)
    if (options?.queryParams) {
      return {
        ...mockContext,
        req: {
          ...mockContext.req,
          query: (name: string) => {
            if (name === "status") return options.queryParams.status || null;
            if (name === "search") return options.queryParams.search || null;
            if (name === "sortBy") return options.queryParams.sortBy || null;
            if (name === "sortDirection")
              return options.queryParams.sortDirection || null;
            return c.req.query(name);
          },
        },
      } as unknown as Context;
    }

    return mockContext;
  };

  return {
    /**
     * Mendapatkan semua todo dengan filter
     * @param options Opsi filter dan sorting
     * @returns Object dengan status success dan todos jika berhasil
     */
    getTodos: async (options?: {
      status?: "all" | "active" | "completed";
      search?: string;
      sortBy?: "title" | "priority" | "dueDate" | "createdAt";
      sortDirection?: "asc" | "desc";
    }) => {
      console.log("[todoContext] Starting getTodos with options:", options);

      // Dapatkan context dengan user dan query params
      const mockContext = await getUserContext({ queryParams: options });

      if (!mockContext) {
        return {
          success: false,
          message: "Authentication required",
          status: 401,
        };
      }

      try {
        console.log("[todoContext] Calling TodoController.getTodos");
        const result = await TodoController.getTodos(mockContext);
        console.log("[todoContext] getTodos result:", {
          success: result.success,
          count: result.todos?.length || 0,
        });

        return result;
      } catch (error) {
        console.error("[todoContext] Error in getTodos:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to get todos",
        };
      }
    },

    /**
     * Mendapatkan satu todo berdasarkan ID
     * @param id ID todo yang akan diambil
     * @returns Object dengan status success dan todo jika berhasil
     */
    getTodo: async (id: number) => {
      console.log(`[todoContext] Starting getTodo for ID: ${id}`);

      // Dapatkan context dengan user
      const mockContext = await getUserContext();

      if (!mockContext) {
        return {
          success: false,
          message: "Authentication required",
          status: 401,
        };
      }

      // Tambahkan parameter id ke request
      const contextWithParam = {
        ...mockContext,
        req: {
          ...mockContext.req,
          param: (name: string) =>
            name === "id" ? id.toString() : mockContext.req.param(name),
        },
      } as unknown as Context;

      try {
        console.log(
          `[todoContext] Calling TodoController.getTodo for ID: ${id}`
        );
        const result = await TodoController.getTodo(contextWithParam);
        console.log(`[todoContext] getTodo result for ID ${id}:`, {
          success: result.success,
          todo: result.todo
            ? { id: result.todo.id, title: result.todo.title }
            : null,
        });

        return result;
      } catch (error) {
        console.error("[todoContext] Error in getTodo:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to get todo",
        };
      }
    },

    /**
     * Membuat todo baru
     * @param data Data todo yang akan dibuat
     * @returns Object dengan status success dan todo jika berhasil
     */
    createTodo: async (data: {
      title: string;
      description?: string;
      priority?: number;
      dueDate?: string;
    }) => {
      console.log("[todoContext] Starting createTodo with data:", data);

      // Dapatkan context dengan user
      const mockContext = await getUserContext();

      if (!mockContext) {
        return {
          success: false,
          message: "Authentication required",
          status: 401,
        };
      }

      // Konversi dan validasi data
      const formattedData = {
        ...data,
        // Pastikan prioritas dalam batas
        priority:
          typeof data.priority === "number"
            ? Math.min(data.priority, 9)
            : data.priority,
        // Format tanggal jika ada
        dueDate: data.dueDate
          ? new Date(data.dueDate).toISOString()
          : undefined,
      };

      console.log("[todoContext] Formatted data:", formattedData);

      // Tambahkan data ke request
      const contextWithData = {
        ...mockContext,
        req: {
          ...mockContext.req,
          json: async () => formattedData,
        },
      } as unknown as Context;

      try {
        console.log("[todoContext] Calling TodoController.createTodo");
        const result = await TodoController.createTodo(contextWithData);
        console.log("[todoContext] createTodo result:", {
          success: result.success,
          message: result.message,
          todo: result.todo
            ? { id: result.todo.id, title: result.todo.title }
            : null,
        });

        return result;
      } catch (error) {
        console.error("[todoContext] Error in createTodo:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to create todo",
        };
      }
    },

    /**
     * Mengupdate todo yang sudah ada
     * @param id ID todo yang akan diupdate
     * @param data Data baru untuk todo
     * @returns Object dengan status success dan todo jika berhasil
     */
    updateTodo: async (
      id: number,
      data: {
        title?: string;
        description?: string;
        completed?: boolean;
        priority?: number;
        dueDate?: string | null;
      }
    ) => {
      console.log(`[todoContext] Starting updateTodo for ID: ${id}`, data);

      // Dapatkan context dengan user
      const mockContext = await getUserContext();

      if (!mockContext) {
        return {
          success: false,
          message: "Authentication required",
          status: 401,
        };
      }

      // Konversi dan validasi data
      const formattedData = {
        ...data,
        // Pastikan prioritas dalam batas jika ada
        priority:
          typeof data.priority === "number"
            ? Math.min(data.priority, 9)
            : data.priority,
        // Format tanggal jika ada
        dueDate: data.dueDate
          ? new Date(data.dueDate).toISOString()
          : data.dueDate,
      };

      // Tambahkan id dan data ke request
      const contextWithParamAndData = {
        ...mockContext,
        req: {
          ...mockContext.req,
          param: (name: string) =>
            name === "id" ? id.toString() : mockContext.req.param(name),
          json: async () => formattedData,
        },
      } as unknown as Context;

      try {
        console.log(
          `[todoContext] Calling TodoController.updateTodo for ID: ${id}`
        );
        const result = await TodoController.updateTodo(contextWithParamAndData);
        console.log(`[todoContext] updateTodo result for ID ${id}:`, {
          success: result.success,
          message: result.message,
          todo: result.todo
            ? { id: result.todo.id, title: result.todo.title }
            : null,
        });

        return result;
      } catch (error) {
        console.error("[todoContext] Error in updateTodo:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to update todo",
        };
      }
    },

    /**
     * Toggle status completed dari todo
     * @param id ID todo yang akan di-toggle
     * @returns Object dengan status success dan todo jika berhasil
     */
    toggleTodo: async (id: number) => {
      console.log(`[todoContext] Starting toggleTodo for ID: ${id}`);

      // Dapatkan context dengan user
      const mockContext = await getUserContext();

      if (!mockContext) {
        return {
          success: false,
          message: "Authentication required",
          status: 401,
        };
      }

      // Tambahkan parameter id ke request
      const contextWithParam = {
        ...mockContext,
        req: {
          ...mockContext.req,
          param: (name: string) =>
            name === "id" ? id.toString() : mockContext.req.param(name),
        },
      } as unknown as Context;

      try {
        console.log(
          `[todoContext] Calling TodoController.toggleTodo for ID: ${id}`
        );
        const result = await TodoController.toggleTodo(contextWithParam);
        console.log(`[todoContext] toggleTodo result for ID ${id}:`, {
          success: result.success,
          message: result.message,
          todo: result.todo
            ? {
                id: result.todo.id,
                title: result.todo.title,
                completed: result.todo.completed,
              }
            : null,
        });

        return result;
      } catch (error) {
        console.error("[todoContext] Error in toggleTodo:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to toggle todo",
        };
      }
    },

    /**
     * Menghapus todo
     * @param id ID todo yang akan dihapus
     * @returns Object dengan status success dan pesan
     */
    deleteTodo: async (id: number) => {
      console.log(`[todoContext] Starting deleteTodo for ID: ${id}`);

      // Dapatkan context dengan user
      const mockContext = await getUserContext();

      if (!mockContext) {
        return {
          success: false,
          message: "Authentication required",
          status: 401,
        };
      }

      // Tambahkan parameter id ke request
      const contextWithParam = {
        ...mockContext,
        req: {
          ...mockContext.req,
          param: (name: string) =>
            name === "id" ? id.toString() : mockContext.req.param(name),
        },
      } as unknown as Context;

      try {
        console.log(
          `[todoContext] Calling TodoController.deleteTodo for ID: ${id}`
        );
        const result = await TodoController.deleteTodo(contextWithParam);
        console.log(`[todoContext] deleteTodo result for ID ${id}:`, {
          success: result.success,
          message: result.message,
        });

        return result;
      } catch (error) {
        console.error("[todoContext] Error in deleteTodo:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to delete todo",
        };
      }
    },

    /**
     * Menghapus semua todo yang completed
     * @returns Object dengan status success, jumlah yang dihapus, dan pesan
     */
    clearCompletedTodos: async () => {
      console.log("[todoContext] Starting clearCompletedTodos");

      // Dapatkan context dengan user
      const mockContext = await getUserContext();

      if (!mockContext) {
        return {
          success: false,
          message: "Authentication required",
          status: 401,
        };
      }

      try {
        console.log("[todoContext] Calling TodoController.clearCompletedTodos");
        const result = await TodoController.clearCompletedTodos(mockContext);
        console.log("[todoContext] clearCompletedTodos result:", {
          success: result.success,
          message: result.message,
          count: result.count || 0,
        });

        return result;
      } catch (error) {
        console.error("[todoContext] Error in clearCompletedTodos:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to clear completed todos",
        };
      }
    },
  };
};

export default createTodoContext;
