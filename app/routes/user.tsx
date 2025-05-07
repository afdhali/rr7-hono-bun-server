import { useLoaderData } from "react-router";
import type { Route } from "./+types/user";

export async function loader({ params, context }: Route.LoaderArgs) {
  const userId = params.id;

  if (!userId) {
    throw new Response("User ID is required", { status: 400 });
  }

  try {
    const user = await context.getUser(parseInt(userId));
    if (!user) {
      throw new Response("User not Found", { status: 404 });
    }
    return { user };
  } catch (error) {
    throw new Response("Error Fetching User", { status: 500 });
  }
}

export default function UserDetails() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>User Detail</h1>
      <p>ID: {user.id}</p>
      <p>Name: {user.name}</p>
      <p>Email: {user.email}</p>
    </div>
  );
}
