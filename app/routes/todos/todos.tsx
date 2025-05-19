// app/routes/about/todos.tsx
import { useState } from "react";
import { useLoaderData, useFetcher, Form, redirect } from "react-router";
import type { Route } from "./+types/layout";

// Tipe untuk Todo
type Todo = {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  priority: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

// Tipe untuk filter
type TodoFilter = {
  status: "all" | "active" | "completed";
  search: string;
  sortBy: "title" | "priority" | "dueDate" | "createdAt";
  sortDirection: "asc" | "desc";
};

// Tipe untuk data dari loader
type LoaderData = {
  todos: Todo[];
  filter: TodoFilter;
};

// Loader function
export async function loader({ request, context }: Route.LoaderArgs) {
  // Parse URL search params for filtering
  const url = new URL(request.url);
  const status = (url.searchParams.get("status") || "all") as
    | "all"
    | "active"
    | "completed";
  const search = url.searchParams.get("search") || "";
  const sortBy = (url.searchParams.get("sortBy") || "createdAt") as
    | "title"
    | "priority"
    | "dueDate"
    | "createdAt";
  const sortDirection = (url.searchParams.get("sortDirection") || "desc") as
    | "asc"
    | "desc";

  // Get todos with filtering options
  const result = await context.todoControllers.getTodos({
    status,
    search,
    sortBy,
    sortDirection,
  });

  if (!result.success) {
    return {
      message: result.message,
      errors: result.errors,
    };
  }

  // Return todos and current filter
  return {
    todos: result.todos || [],
    filter: { status, search, sortBy, sortDirection },
  };
}

// Server Action function
export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  // Handle create todo
  if (intent === "create") {
    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || undefined;
    const priorityValue = formData.get("priority");
    const priority = priorityValue
      ? parseInt(priorityValue as string)
      : undefined;
    const dueDateValue = (formData.get("dueDate") as string) || undefined;

    const result = await context.todoControllers.createTodo({
      title,
      description,
      priority,
      dueDate: dueDateValue,
    });

    // Return langsung result dari controller
    return result;
  }

  // Handle update todo
  if (intent === "update") {
    const todoId = parseInt(formData.get("todoId") as string);
    const data: any = {};

    // Only include fields that were provided
    if (formData.has("title")) data.title = formData.get("title") as string;
    if (formData.has("description"))
      data.description = formData.get("description") as string;
    if (formData.has("completed"))
      data.completed = formData.get("completed") === "true";
    if (formData.has("priority"))
      data.priority = parseInt(formData.get("priority") as string);
    if (formData.has("dueDate")) {
      data.dueDate = formData.get("dueDate")
        ? (formData.get("dueDate") as string)
        : null;
    }

    const result = await context.todoControllers.updateTodo(todoId, data);
    return result;
  }

  // Handle toggle todo
  if (intent === "toggle") {
    const todoId = parseInt(formData.get("todoId") as string);
    const result = await context.todoControllers.toggleTodo(todoId);
    return result;
  }

  // Handle delete todo
  if (intent === "delete") {
    const todoId = parseInt(formData.get("todoId") as string);
    const result = await context.todoControllers.deleteTodo(todoId);
    return result;
  }

  // Handle clear completed todos
  if (intent === "clearCompleted") {
    const result = await context.todoControllers.clearCompletedTodos();
    return result;
  }

  return { success: false, message: "Invalid intent" };
}

// Format date for display
function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

// Get priority class
function getPriorityClass(priority: number): string {
  if (priority >= 8) return "bg-red-100 text-red-800";
  if (priority >= 5) return "bg-yellow-100 text-yellow-800";
  if (priority >= 3) return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-800";
}

// Main component
export default function TodosPage() {
  const { todos, filter } = useLoaderData() as LoaderData;
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoDescription, setNewTodoDescription] = useState("");
  const [newTodoPriority, setNewTodoPriority] = useState(0);
  const [newTodoDueDate, setNewTodoDueDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const fetcher = useFetcher();

  const isSubmitting = fetcher.state === "submitting";

  // Handle form submission for creating/updating todo
  const handleSubmitTodo = (e: React.FormEvent) => {
    e.preventDefault();

    if (newTodoTitle.trim() === "") return;

    // Gunakan FormData
    const formData = new FormData();

    if (editingTodo) {
      // Update existing todo
      formData.append("intent", "update");
      formData.append("todoId", editingTodo.id.toString());
      formData.append("title", newTodoTitle);
      formData.append("description", newTodoDescription);
      // Pastikan priority di bawah 10 (maksimum 9)
      const safetyPriority = Math.min(newTodoPriority, 9);
      formData.append("priority", safetyPriority.toString());

      // Format dueDate jika ada
      if (newTodoDueDate) {
        const formattedDate = new Date(newTodoDueDate).toISOString();
        formData.append("dueDate", formattedDate);
      }
    } else {
      // Create new todo
      formData.append("intent", "create");
      formData.append("title", newTodoTitle);
      formData.append("description", newTodoDescription);
      // Pastikan priority di bawah 10 (maksimum 9)
      const safetyPriority = Math.min(newTodoPriority, 9);
      formData.append("priority", safetyPriority.toString());

      // Format dueDate jika ada
      if (newTodoDueDate) {
        const formattedDate = new Date(newTodoDueDate).toISOString();
        formData.append("dueDate", formattedDate);
      }
    }

    console.log("Submitting todo data:", {
      title: newTodoTitle,
      description: newTodoDescription,
      priority: Math.min(newTodoPriority, 9),
      dueDate: newTodoDueDate ? new Date(newTodoDueDate).toISOString() : null,
    });

    fetcher.submit(formData, { method: "post" });

    // Clear form
    setNewTodoTitle("");
    setNewTodoDescription("");
    setNewTodoPriority(0);
    setNewTodoDueDate("");
    setShowForm(false);
    setEditingTodo(null);
  };

  // Handle edit todo
  const handleEditTodo = (todo: Todo) => {
    // Set editing mode
    setEditingTodo(todo);

    // Isi form dengan data todo yang akan diedit
    setNewTodoTitle(todo.title || "");

    // Handle description yang bisa null
    setNewTodoDescription(todo.description || "");

    // Set priority
    setNewTodoPriority(todo.priority || 0);

    // Format dueDate jika ada, jika tidak ada set sebagai string kosong
    if (todo.dueDate) {
      // Format tanggal untuk input datetime-local (YYYY-MM-DDTHH:MM)
      const date = new Date(todo.dueDate);

      // Pastikan tanggal valid
      if (!isNaN(date.getTime())) {
        // Format tanggal sesuai format input datetime-local: YYYY-MM-DDTHH:MM
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");

        setNewTodoDueDate(`${year}-${month}-${day}T${hours}:${minutes}`);
      } else {
        setNewTodoDueDate("");
      }
    } else {
      setNewTodoDueDate("");
    }

    // Tampilkan form
    setShowForm(true);

    console.log("Editing todo:", {
      id: todo.id,
      title: todo.title,
      description: todo.description,
      priority: todo.priority,
      dueDate: todo.dueDate,
      formatted: todo.dueDate ? newTodoDueDate : "(no due date)",
    });
  };

  // Handle toggle todo - gunakan FormData
  const handleToggleTodo = (todoId: number) => {
    const formData = new FormData();
    formData.append("intent", "toggle");
    formData.append("todoId", todoId.toString());

    fetcher.submit(formData, { method: "post" });
  };

  // Handle delete todo - gunakan FormData
  const handleDeleteTodo = (todoId: number) => {
    if (confirm("Are you sure you want to delete this todo?")) {
      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("todoId", todoId.toString());

      fetcher.submit(formData, { method: "post" });
    }
  };

  // Handle clear completed todos - gunakan FormData
  const handleClearCompleted = () => {
    if (confirm("Are you sure you want to clear all completed todos?")) {
      const formData = new FormData();
      formData.append("intent", "clearCompleted");

      fetcher.submit(formData, { method: "post" });
    }
  };

  // Count completed todos
  const completedCount = todos.filter((todo) => todo.completed).length;

  return (
    <div className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-xl bg-white shadow">
          {/* Page header */}
          <div className="bg-indigo-600 px-6 py-5 sm:px-8">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">My Todos</h1>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setEditingTodo(null);
                    setNewTodoTitle("");
                    setNewTodoDescription("");
                    setNewTodoPriority(0);
                    setNewTodoDueDate("");
                    setShowForm(!showForm);
                  }}
                  className="inline-flex items-center rounded-md bg-indigo-800 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  {showForm ? "Cancel" : "Add Todo"}
                </button>

                {completedCount > 0 && (
                  <button
                    onClick={handleClearCompleted}
                    className="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                  >
                    Clear Completed
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8">
            {/* Todo form */}
            {showForm && (
              <div className="mb-8 rounded-md border border-gray-200 p-6">
                <h2 className="mb-4 text-lg font-medium text-gray-900">
                  {editingTodo ? "Edit Todo" : "Add New Todo"}
                </h2>
                <form onSubmit={handleSubmitTodo}>
                  <div className="mb-4">
                    <label
                      htmlFor="title"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Title*
                    </label>
                    <input
                      id="title"
                      type="text"
                      value={newTodoTitle}
                      onChange={(e) => setNewTodoTitle(e.target.value)}
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="mb-4">
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={newTodoDescription}
                      onChange={(e) => setNewTodoDescription(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
                    <div>
                      <label
                        htmlFor="priority"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Priority (0-10)
                      </label>
                      <input
                        id="priority"
                        type="number"
                        min="0"
                        max="9"
                        value={newTodoPriority}
                        onChange={(e) =>
                          setNewTodoPriority(parseInt(e.target.value) || 0)
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="dueDate"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Due Date
                      </label>
                      <input
                        id="dueDate"
                        type="datetime-local"
                        value={newTodoDueDate}
                        onChange={(e) => setNewTodoDueDate(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting || !newTodoTitle.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
                    >
                      {isSubmitting
                        ? "Saving..."
                        : editingTodo
                        ? "Update Todo"
                        : "Add Todo"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Filter form */}
            <div className="mb-8 bg-gray-50 p-4 rounded-md">
              <Form method="get" className="flex flex-wrap items-end gap-3">
                <div>
                  <label
                    htmlFor="search"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Search
                  </label>
                  <input
                    type="text"
                    id="search"
                    name="search"
                    defaultValue={filter.search}
                    placeholder="Search todos..."
                    className="px-3 py-2 border rounded-md border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="status"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={filter.status}
                    className="px-3 py-2 border rounded-md border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="sortBy"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Sort By
                  </label>
                  <select
                    id="sortBy"
                    name="sortBy"
                    defaultValue={filter.sortBy}
                    className="px-3 py-2 border rounded-md border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="createdAt">Date Created</option>
                    <option value="title">Title</option>
                    <option value="priority">Priority</option>
                    <option value="dueDate">Due Date</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="sortDirection"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Direction
                  </label>
                  <select
                    id="sortDirection"
                    name="sortDirection"
                    defaultValue={filter.sortDirection}
                    className="px-3 py-2 border rounded-md border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors text-gray-800"
                >
                  Apply Filters
                </button>
              </Form>
            </div>

            {/* Todo stats */}
            <div className="mb-4 text-sm text-gray-600">
              {todos.length} total, {completedCount} completed
            </div>

            {/* Todo list */}
            {todos.length === 0 ? (
              <div className="mt-8 rounded-md bg-blue-50 p-8 text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="mx-auto h-12 w-12 text-blue-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                  />
                </svg>

                <h3 className="mt-2 text-lg font-medium text-blue-800">
                  No todos found
                </h3>
                <p className="mt-1 text-blue-700">
                  {filter.search || filter.status !== "all"
                    ? "Try changing your filters or add a new todo."
                    : "Add your first todo to get started."}
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-gray-200">
                <ul className="divide-y divide-gray-200">
                  {todos.map((todo) => (
                    <li
                      key={todo.id}
                      className={`p-4 hover:bg-gray-50 ${
                        todo.completed ? "bg-gray-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center min-w-0">
                          <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={() => handleToggleTodo(todo.id)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <div className="ml-3 flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium ${
                                todo.completed
                                  ? "text-gray-500 line-through"
                                  : "text-gray-900"
                              }`}
                            >
                              {todo.title}
                            </p>
                            {todo.description && (
                              <p className="mt-1 text-sm text-gray-500 truncate">
                                {todo.description}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getPriorityClass(
                                  todo.priority
                                )}`}
                              >
                                Priority: {todo.priority}
                              </span>
                              {todo.dueDate && (
                                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                                  Due: {formatDate(todo.dueDate)}
                                </span>
                              )}
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                                Created: {formatDate(todo.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0 flex">
                          <button
                            onClick={() => handleEditTodo(todo)}
                            className="mr-2 text-indigo-600 hover:text-indigo-900"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="h-5 w-5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteTodo(todo.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="h-5 w-5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
