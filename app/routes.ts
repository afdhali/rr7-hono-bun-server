import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route(
    "about",
    "routes/about/layout.tsx",
    {
      id: "aboutLayout",
    },
    [index("routes/about/index.tsx")]
  ),
  route(
    "todos",
    "routes/todos/layout.tsx",
    {
      id: "TodosLayout",
    },
    [index("routes/todos/todos.tsx")]
  ),
  route("users", "routes/users.tsx"),
  route("users/:id", "routes/user.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("verify-email", "routes/verify-email.tsx"),
  route("verification-pending", "routes/verification-pending.tsx"),
] satisfies RouteConfig;
