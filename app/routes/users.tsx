import { Link, useLoaderData } from "react-router";

import type { User } from "types/server";
import type { Route } from "./+types/users";

export async function loader({ context }: Route.LoaderArgs) {
  const users = await context.getAllUser();
  return users;
}

export default function Users() {
  const users = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>Users</h1>
      {users.length === 0 ? (
        <p>No users found</p>
      ) : (
        <ul>
          {users.map((user: User) => (
            <li key={user.id}>
              <Link to={`/users/${user.id}`}>
                {user.name} ({user.email})
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
