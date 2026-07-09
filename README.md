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
   - VITE_SUPABASE_SECRET_KEY
   - SUPABASE_URL (opcional, para el backend/server)
   - SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY (opcional, para el backend/server)
3. Ejecuta la compilación:
   npm run build
4. Para GitHub Pages, genera la build con:
   GITHUB_PAGES=1 npm run build

## Base de datos
La interfaz se conecta directamente a Supabase. Si también quieres usar el servidor local, puedes arrancarlo con:
   node server/index.js
