# Mesa Viva

Recetario de la Unidad 3: varias pantallas, registro con validación, un web service propio y la API externa [TheMealDB](https://www.themealdb.com/api.php).

No hace falta `npm install`. El servidor usa solo módulos de Node.js.

## Pantallas

- **Inicio** (`/`) — búsqueda y una receta destacada que llega de la API.
- **Recetas** (`/recetas`) — listado del tema, con categorías y búsqueda.
- **Detalle** (`/receta?id=`) — ingredientes y preparación.
- **Registro** (`/registro`) — validación en el navegador y otra vez en el servidor.
- **Seguridad** (`/seguridad`) — qué se protege y la respuesta JSON del servicio.

## Cómo ejecutarlo

Requiere Node.js 18 o superior.

```bash
copy .env.example .env
```

Abre `.env` y escribe la clave. TheMealDB documenta `1` como clave de prueba:

```
PORT=3000
MEALDB_API_KEY=1
```

```bash
node server.js
```

Abre `http://localhost:3000`.

Las capturas de las pantallas funcionando están en `entrega/Mesa-Viva-capturas.pdf`.

## La clave no se sube

- La aplicación lee `MEALDB_API_KEY` solo en el servidor, desde `.env`.
- `.env` está en `.gitignore`.
- El repositorio incluye `.env.example` con la variable vacía.
- El navegador llama a `/api/recetas`, no a TheMealDB. Así la clave no queda en el JavaScript público.

## Seguridad que sí está en el código

- Validación de nombre, correo y contraseña en cliente y servidor.
- Contraseñas con scrypt y sal aleatoria. El servicio no devuelve el hash.
- Cabeceras `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options` y límite de intentos en `POST /api/registro`.
- Textos de la API insertados con `textContent`.
- Imágenes aceptadas solo si son HTTPS y vienen de `themealdb.com`.
