import { Link, useLoaderData } from "react-router";

import type { User } from "types/server";
import type { Route } from "./+types/users";
import { useGetUsersQuery } from "~/store/api";

export async function loader({ context }: Route.LoaderArgs) {
  // const users = await context.getAllUser();
  // return users;

  // Return minimal data for initial render
  return { initialTimestamp: new Date().toISOString() };
}

export default function Users() {
  // Get minimal data from loader
  const { initialTimestamp } = useLoaderData<typeof loader>();

  // const users = useLoaderData<typeof loader>();

  // Use RTK Query for the "deferred" data
  const { data: users, isLoading, error } = useGetUsersQuery();

  return (
    // <div>
    //   <h1>Users</h1>
    //   {users.length === 0 ? (
    //     <p>No users found</p>
    //   ) : (
    //     <ul>
    //       {users.map((user: User) => (
    //         <li key={user.id}>
    //           <Link to={`/users/${user.id}`}>
    //             {user.name} ({user.email})
    //           </Link>
    //         </li>
    //       ))}
    //     </ul>
    //   )}
    // </div>
    <div>
      <h1>Users</h1>
      <p>Initial page load: {initialTimestamp}</p>

      {isLoading ? (
        <p>Loading users...</p>
      ) : error ? (
        <p>Error loading users: {(error as any).message}</p>
      ) : !users || users.length === 0 ? (
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
