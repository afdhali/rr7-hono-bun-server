# React Router v7 Framework Mode dengan Hono JS & Bun

Repository ini berisi implementasi template full-stack menggunakan React Router v7 Framework Mode yang diintegrasikan dengan Hono JS menggunakan adapter [react-router-hono-server](https://github.com/rphlmr/react-router-hono-server).

## Teknologi Utama

- **React Router v7** - Framework React - sebelumnya Remix Run [react-router](https://reactrouter.com/)
- **Hono JS** - Framework server ringan dan cepat [hono](https://hono.dev/)
- **Bun** - JavaScript runtime dan bundler [bun](https://bun.sh/)
- **Redux Toolkit & RTK Query** - Manajemen state dan data fetching [redux toolkit](https://redux-toolkit.js.org/)
- **Drizzle ORM** - Query builder untuk database SQL [drizzle](https://orm.drizzle.team/)
- **TypeScript** - Type safety untuk development

## Fitur yang Tersedia

- **Sistem Autentikasi Lengkap**:

  - Login/Register dengan JWT (disimpan dalam HTTP-only cookies)
  - Email verifikasi untuk registrasi pengguna baru
  - Token refresh otomatis
  - Perlindungan rute berbasis autentikasi
  - sistem role-based access control (RBAC)
  - Manajemen session

- **Google OAuth** - DONE --- Menggunakan @hono/oauth-providers library adapter

- **Pre-fetching Data**:

  - Contoh prefetch menggunakan RTK Query di rute `/users` dan `/users/:id`
  - Dukungan Suspense pada RTK Query

- **SSR (Server Side Rendering)**:

  - Hydration state antara server dan client
  - Error handling untuk rendering yang gagal

- **Middleware Keamanan**:

  - CSRF Protection
  - Secure Headers
  - Fingerprinting untuk validasi token

- **Dokumentasi**:
  - Debug Console yang komprehensif

## Prasyarat - PENTING !!

- [Bun](https://bun.sh/) (versi terbaru)
- [React Router v7 Framework Mode](https://reactrouter.com/)
- [react-router-hono-server](https://github.com/rphlmr/react-router-hono-server)

## Cara Memulai

### Instalasi

1. Clone repository ini
2. Install dependensi dengan Bun:

```bash
bun install
```

3. Salin file `.env.sample` ke `.env` dan sesuaikan dengan konfigurasi Anda:

```bash
cp .env.sample .env
```

4. Atur variabel lingkungan Anda:

```
BUN_VERSION="1.x.x"  # Sesuaikan dengan versi Bun Anda

# URL Server internal, jangan gunakan nama domain
# Untuk mode Dev, gunakan http://localhost:5173
BASE_URL="http://localhost:3000"

# Jika tanpa domain, mode DEV menggunakan http://localhost:5713, mode PROD menggunakan http://localhost:3000
APP_URL="https://domain-anda.com"
DATABASE_URL="url-database-anda"

ACCESS_TOKEN_SECRET="rahasia-token-akses-anda"
REFRESH_TOKEN_SECRET="rahasia-token-refresh-anda"

COOKIE_SECRET="rahasia-cookie-anda"

# Untuk CSRF Origin
APP_ORIGIN="https://domain-anda.com"

# EMAIL
RESEND_API_KEY="api-key-resend-anda"
DEFAULT_FROM_EMAIL="email@domain-resend-terdaftar-anda"
```

### Database

Gunakan perintah Drizzle untuk mengelola database Anda:

```bash
# Generate skema database
bunx drizzle-kit generate

# Migrasi database
bunx drizzle-kit migrate

# Push skema ke database
bunx drizzle-kit push
```

### Menjalankan Aplikasi

```bash
# Mode development
bun dev

# Build untuk production
bun run build

# Menjalankan versi production
bun start
```

## Cara Menggunakan

### Rute yang Tersedia

- `/` - Halaman Utama
- `/login` - Halaman Login
- `/register` - Halaman Registrasi
- `/verify-email` - Verifikasi Email
- `/verification-pending` - Menunggu Verifikasi Email
- `/about` - Halaman Terlindungi (Memerlukan Autentikasi)
- `/users` - Daftar Pengguna (Contoh Prefetch)
- `/users/:id` - Detail Pengguna (Contoh Prefetch)

### Autentikasi

Sistem ini menggunakan JWT (JSON Web Token) untuk autentikasi dengan dua token:

1. **Access Token** - Disimpan dalam HTTP-only cookie, berumur pendek (15 menit)
2. **Refresh Token** - Disimpan dalam database dan HTTP-only cookie, berumur panjang (7 hari)

Implementasi mencakup:

- Rotasi token refresh
- Validasi token dengan fingerprinting
- Pencabutan token
- Email verifikasi untuk pengguna baru

### Hook useAuth

Hook `useAuth` adalah cara utama untuk mengakses dan mengelola status autentikasi di komponen React Anda. Contoh penggunaan dapat dilihat di `routes/about/layout.tsx`.

```tsx
const { user, isAuthenticated, logout, refreshToken } = useAuth();

// Cek apakah user terautentikasi
if (isAuthenticated) {
  // Lakukan sesuatu untuk user yang terautentikasi
}

// Logout user
const handleLogout = () => {
  logout();
};

// Refresh token secara manual
const handleRefresh = async () => {
  await refreshToken();
};
```

### Prefetching Data

Untuk melakukan prefetch data, Anda perlu:

1. Menambahkan konfigurasi prefetch di `entry.server.tsx` (lihat pattern yang sudah ada)
2. Menggunakan RTK Query untuk mengambil data

Contoh prefetch sudah disediakan pada rute `/users` dan `/users/:id`.

## Aliran Data ke Hono JS

Ada dua cara untuk mengirim/mengambil data ke/dari Hono JS:

### 1. Menggunakan AppLoadContext React Router

React Router menyediakan AppLoadContext melalui adapter `react-router-hono-server` yang memungkinkan akses langsung ke controller server:

```tsx
// Dalam loader atau action
export async function loader({ request, context }: Route.LoaderArgs) {
  // Menggunakan controller secara langsung
  const isAuthenticated = await context.isAuthenticated();
  const user = await context.getCurrentUser();

  // Untuk auth controller
  const result = await context.authControllers.verifyEmail(token);

  return { user, isAuthenticated };
}
```

### 2. Menggunakan Fetch API

Alternatif untuk menggunakan Fetch API langsung dalam loader atau action:

```tsx
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const response = await fetch(`${process.env.BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  // Handle response
  if (!response.ok) {
    // Handle error
  }

  return await response.json();
}
```

## Struktur Project

```
app/
├── components/         # Komponen React yang dapat digunakan kembali
├── db/                 # Konfigurasi dan skema database
├── hooks/              # Custom React hooks (termasuk useAuth)
├── routes/             # Komponen dan logika routing
│   ├── +types/         # Definisi tipe untuk rute
│   ├── about/          # Rute yang dilindungi
│   ├── login.tsx       # Halaman login
│   ├── register.tsx    # Halaman registrasi
│   ├── verify-email.tsx # Verifikasi email
│   └── ...             # Rute lainnya
├── server/             # Kode sisi server
│   ├── controllers/    # Logika controller
│   ├── middlewares/    # Middleware server
│   ├── models/         # Model data
│   └── services/       # Layanan business logic
│   └── index           # Main Setup Server Hono - definisikan getLoadContext
├── store/              # Konfigurasi Redux store
│   ├── api.ts          # Setup RTK Query API
│   ├── authApi.ts      # API untuk autentikasi
│   └── authSlice.ts    # State untuk autentikasi
├── types/              # Definisi tipe global
├── utils/              # Utility functions
├── app.css             # Stylesheet utama
├── entry.client.tsx    # Entry point untuk client
├── entry.server.tsx    # Entry point untuk server
├── root.tsx            # Komponen root react
└── routes.ts           # Konfigurasi rute react-router
```

## Pengembangan Lebih Lanjut

Beberapa ide untuk pengembangan selanjutnya:

1. Penambahan rate limiting untuk endpoints penting

## Kontribusi

Kontribusi sangat dipersilakan. Silakan buka issue atau pull request jika Anda ingin berkontribusi.

## Lisensi

[MIT](LICENSE)

---

"Selamat Ber Kreasi dan Ber Fantasi - Salam dari EmeshDev"
