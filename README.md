# Horario V2

Versión independiente de la aplicación preparada para desplegar como un único servicio con frontend y backend juntos.

## Requisitos
- Node.js
- Acceso a una base de datos PostgreSQL/Supabase

## Configuración
1. Instala dependencias:
   npm install
2. Añade tus credenciales en .env:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY
3. Ejecuta la compilación:
   npm run build
4. Inicia la aplicación:
   node server/index.js

## Base de datos
La aplicación se conecta a Supabase/Postgres a través del backend.
