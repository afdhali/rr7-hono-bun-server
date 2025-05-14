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
  route("users", "routes/users.tsx"),
  route("users/:id", "routes/user.tsx"),
  route("login", "routes/login.tsx"),
] satisfies RouteConfig;
