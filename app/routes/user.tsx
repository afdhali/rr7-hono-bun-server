import { useLoaderData, useParams } from "react-router";
import { useGetUserByIdQuery } from "~/store/api";

// export async function loader({ params, context }: Route.LoaderArgs) {
//   const userId = params.id;

//   if (!userId) {
//     throw new Response("User ID is required", { status: 400 });
//   }

//   try {
//     const user = await context.getUser(parseInt(userId));
//     if (!user) {
//       throw new Response("User not Found", { status: 404 });
//     }
//     return { user };
//   } catch (error) {
//     throw new Response("Error Fetching User", { status: 500 });
//   }
// }

export async function loader() {
  // You can return minimal data here if needed
  // or just an empty object
  return {};
}

// export default function UserDetails() {
//   const { user } = useLoaderData<typeof loader>();

//   return (
//     <div>
//       <h1>User Detail</h1>
//       <p>ID: {user.id}</p>
//       <p>Name: {user.name}</p>
//       <p>Email: {user.email}</p>
//     </div>
//   );
// }

export default function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id || "0");

  // Use RTK Query instead of loader data
  const {
    data: user,
    isLoading,
    error,
  } = useGetUserByIdQuery(userId, {
    // Skip query if ID is invalid
    skip: isNaN(userId) || userId <= 0,
  });

  if (isNaN(userId) || userId <= 0) {
    return <div>Invalid user ID</div>;
  }

  if (isLoading) {
    return <div>Loading user details...</div>;
  }

  if (error) {
    return <div>Error: {(error as any).message || "Failed to load user"}</div>;
  }

  if (!user) {
    return <div>User not found</div>;
  }

  return (
    <div>
      <h1>User Detail</h1>
      <p>ID: {user.id}</p>
      <p>Name: {user.name}</p>
      <p>Email: {user.email}</p>
    </div>
  );
}
