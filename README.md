# Horario V2

Aplicación preparada para funcionar con Supabase desde un frontend estático y para desplegarse en GitHub Pages.

## Requisitos
- Node.js
- Acceso a Supabase

## Configuración
1. Instala dependencias:
   npm install
2. Añade tus credenciales en .env:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY o VITE_SUPABASE_PUBLISHABLE_KEY (clave pública apta para el frontend)
   - SUPABASE_URL (para el backend/server)
   - SUPABASE_SERVICE_ROLE_KEY (solo para el backend; nunca usar una clave secret o service role en el frontend)
3. En GitHub Actions, configura los secrets `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para el workflow de GitHub Pages. La clave `anon`/`publishable` es pública y puede estar incluida en la aplicación del navegador; protege los datos con las políticas RLS de Supabase.
4. Ejecuta la compilación:
   npm run build
5. Para GitHub Pages, genera la build con:
   GITHUB_PAGES=1 npm run build

## Base de datos
La interfaz se conecta directamente a Supabase. Si también quieres usar el servidor local, puedes arrancarlo con:
   node server/index.js
