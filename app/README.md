# RL HABITT App

Una aplicación para la gestión de propiedades de alquiler construida con Supabase.

## Estructura de la Base de Datos

La aplicación utiliza una base de datos Supabase (PostgreSQL) con la siguiente estructura:

### Tablas

- `buildings`: Edificios o complejos de propiedades
- `owners`: Propietarios
- `apartments`: Unidades de alquiler individuales
- `payment_sources`: Métodos/plataformas de pago
- `guests`: Personas que alquilan los apartamentos
- `bookings`: Reservas de alquiler (abarcan varios días)
- `reservations`: Días individuales de reserva
- `color_meanings`: Define los colores utilizados en las hojas de Excel
- `import_logs`: Rastrea importaciones desde hojas de Excel

## Primeros Pasos

### 1. Configuración de Supabase

1. Crea una cuenta en [Supabase](https://supabase.com/) si aún no tienes una
2. Crea un nuevo proyecto
3. Copia la URL de tu proyecto y la clave anónima

### 2. Configuración del CLI de Supabase

Instala el CLI de Supabase:

```bash
# Usando npm
npm install -g supabase

# O usando Homebrew (en macOS)
brew install supabase/tap/supabase
```

Inicia Supabase en tu proyecto:

```bash
cd /Users/nelsonperez/code/claude/rlhabitt_backend/app
supabase init
```

Vincula tu proyecto a tu instancia de Supabase:

```bash
supabase login
supabase link --project-ref tu-referencia-de-proyecto
```

Encontrarás tu referencia de proyecto en la URL del panel de control de Supabase.

### 3. Aplicar Migraciones

Una vez que has configurado el CLI de Supabase y vinculado tu proyecto, puedes aplicar las migraciones:

```bash
supabase db push
```

Esto aplicará todas las migraciones en el directorio `migrations` a tu base de datos.

### 4. Importar Datos

Para importar datos desde un archivo JSON a Supabase, puedes usar el script de importación:

```bash
# Instalar dependencias
pip install python-dotenv supabase

# Configurar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales de Supabase

# Importar datos desde un archivo JSON
python import_data.py /ruta/a/reservations.json
```

Alternativamente, puedes usar el Editor SQL de Supabase para llamar a la función de importación directamente:

```sql
SELECT public.import_json('tu-datos-json-aquí');
```

## Notas sobre el Diseño de la Base de Datos

- El esquema separa edificios, apartamentos, propietarios y huéspedes para mayor flexibilidad
- Las reservas (bookings) representan una estancia de varios días con una sola transacción
- Las reservas individuales (reservations) son entradas para cada día para cada apartamento
- La tabla de significados de colores almacena la asignación de colores a sus significados
- Los registros de importación rastrean cuándo y qué datos se importaron

## API RESTful

Supabase genera automáticamente una API RESTful completa para todas tus tablas. Puedes usar esta API para:

1. Obtener listados de edificios, apartamentos, reservas
2. Crear nuevas reservas
3. Actualizar información de propietarios y huéspedes
4. Y mucho más

Consulta la documentación de Supabase para obtener más información sobre cómo usar la API.