// app/server/models/userModel.ts
export interface User {
  id: number;
  name: string;
  email: string;
}

// Data awal sebagai "database" sederhana
export const users: User[] = [
  { id: 1, name: "User 1", email: "user1@example.com" },
  { id: 2, name: "User 2", email: "user2@example.com" },
  { id: 3, name: "User 3", email: "user3@example.com" },
];

// Model methods untuk User
export const UserModel = {
  findAll: () => users,

  findById: (id: number) => users.find((u) => u.id === id),

  create: (userData: Omit<User, "id">) => {
    const newUser = {
      id: users.length + 1,
      ...userData,
    };
    users.push(newUser);
    return newUser;
  },

  update: (id: number, userData: Partial<Omit<User, "id">>) => {
    const userIndex = users.findIndex((u) => u.id === id);
    if (userIndex === -1) return null;

    const updatedUser = {
      ...users[userIndex],
      ...userData,
      id, // Pastikan ID tetap sama
    };
    users[userIndex] = updatedUser;
    return updatedUser;
  },

  delete: (id: number) => {
    const userIndex = users.findIndex((u) => u.id === id);
    if (userIndex === -1) return null;

    const deletedUser = users[userIndex];
    users.splice(userIndex, 1);
    return deletedUser;
  },
};
