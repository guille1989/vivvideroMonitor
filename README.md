# 🟦 InnoApp · Google Reviews Monitor

Dashboard de monitoreo de reseñas de Google Maps en tiempo real.

**Stack:** React + Vite · Tailwind CSS · TanStack Query · Socket.IO · Node.js · Express · MongoDB · Recharts

---

## 📁 Estructura del proyecto

```
google-reviews-monitor/
├── client/                    # Frontend React + Vite
│   ├── src/
│   │   ├── components/        # Componentes UI reutilizables
│   │   ├── hooks/             # useSocket, useToast
│   │   ├── pages/             # DashboardPage, AnalyticsPage
│   │   ├── services/          # api.js (axios)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── tailwind.config.js
│
└── server/                    # Backend Express
    └── src/
        ├── config/            # database.js
        ├── models/            # Review.js, BusinessSnapshot.js
        ├── routes/            # businessRoutes.js, healthRoutes.js
        ├── controllers/       # businessController.js
        ├── services/          # googlePlacesService.js, syncService.js
        ├── jobs/              # syncJob.js (polling 1 min)
        ├── socket/            # socketManager.js
        ├── utils/             # hashUtils.js, logger.js
        ├── app.js
        └── index.js
```

---

## ✅ Requisitos previos

- **Node.js** v18+ y **npm**
- **MongoDB** corriendo en localhost:27017
  - Instalación local: https://www.mongodb.com/try/download/community
  - O usar MongoDB Atlas (ajusta MONGODB_URI)
- **Google Places API Key** con el API "Places API" habilitado
  - Consola: https://console.cloud.google.com/apis/library/places-backend.googleapis.com

---

## 🚀 Instalación y arranque

### 1. Clonar / descomprimir el proyecto

```bash
cd google-reviews-monitor
```

### 2. Configurar el backend

```bash
cd server

# Copiar variables de entorno
cp .env.example .env
```

Edita `server/.env` con tus valores:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/google-reviews-monitor
GOOGLE_PLACES_API_KEY=AIzaSy...TU_KEY_AQUI
PLACE_ID=ChIJgdfWKLaaP44R59EHzMeJdX0
SYNC_INTERVAL_MS=60000
REVIEW_REMOVAL_GRACE_CYCLES=3
CLIENT_URL=http://localhost:5173
```

```bash
# Instalar dependencias del servidor
npm install

# Arrancar el backend (desarrollo con hot-reload)
npm run dev
```

El servidor estará en: `http://localhost:3001`

### 3. Configurar el frontend

```bash
# Desde la raíz del proyecto
cd client

# Instalar dependencias
npm install

# Arrancar el frontend
npm run dev
```

El frontend estará en: `http://localhost:5173`

---

## 🔑 Obtener Google Places API Key

1. Ve a https://console.cloud.google.com
2. Crea un proyecto nuevo (o usa uno existente)
3. Ve a **APIs & Services > Library**
4. Busca y habilita **"Places API"**
5. Ve a **APIs & Services > Credentials**
6. Crea una API Key
7. (Recomendado) Restringe la key a "Places API" y a tu IP

> ⚠️ La API de Places tiene costos después de los primeros $200/mes de crédito gratuito. Cada llamada a Place Details cuesta ~$0.017 USD. Con polling de 1 minuto son ~$24/mes.

---

## 📡 Endpoints disponibles

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del sistema |
| GET | `/api/business/:placeId/summary` | Resumen del negocio |
| GET | `/api/business/:placeId/reviews` | Lista de reviews con filtros |
| GET | `/api/business/:placeId/metrics` | Métricas para gráficas |
| POST | `/api/business/:placeId/sync` | Trigger de sync manual |

### Filtros para `/reviews`:
```
?rating=5          # Filtrar por estrellas (1-5)
?onlyNew=true      # Solo reseñas nuevas
?onlyNegative=true # Solo reseñas negativas
?includeRemoved=true # Incluir reseñas removidas
?onlyRemoved=true    # Solo reseñas removidas
?search=texto      # Búsqueda en texto y autor
?page=1&limit=20   # Paginación
```

---

## 🔌 Eventos Socket.IO

| Evento | Descripción |
|--------|-------------|
| `review:new` | Nueva review detectada |
| `review:negative` | Review negativa (1-2★) |
| `review:removed` | Review marcada como removida en Google |
| `business:rating_changed` | Cambio en el rating promedio |
| `sync:started` | Inicio de sincronización |
| `sync:finished` | Fin de sincronización |
| `sync:error` | Error durante sync |

`REVIEW_REMOVAL_GRACE_CYCLES` define cuántos ciclos consecutivos sin aparecer debe tener una reseña para marcarse como removida (default: 3).
> Nota: Google Places puede devolver un subconjunto de reseñas recientes; la detección de removidas es heurística.

---

## 🎨 Funcionalidades del dashboard

### Dashboard principal
- Nombre del negocio y rating actual
- KPIs: Rating · Total reviews · Nuevas · Negativas
- Alertas visuales automáticas
- Lista de reviews con filtros (estrellas, texto, solo nuevas, solo negativas)
- Paginación

### Analítica
- Distribución de reviews por estrella (BarChart + PieChart)
- Reviews detectadas por día (últimos 30 días)
- Evolución del rating en el tiempo

### Tiempo real
- Toast notifications al llegar nueva review
- Toast con alerta especial para reviews negativas
- Indicador de cambio de rating
- Indicador de estado de conexión Socket.IO

---

## 🛑 Solución de problemas

**Error "GOOGLE_PLACES_API_KEY no configurada"**
→ Verifica que el archivo `.env` existe en `/server` y tiene la key correcta.

**Error "Negocio no encontrado"**
→ El backend necesita al menos una sincronización. Haz click en "Sincronizar" o espera 1 minuto.

**Socket.IO no conecta**
→ Verifica que `CLIENT_URL` en el `.env` del server coincide con la URL del frontend.

**MongoDB connection refused**
→ Asegúrate de que MongoDB está corriendo: `sudo systemctl start mongod` (Linux) o `mongod` (Mac/Windows).

---

## 📦 Scripts disponibles

### Server
```bash
npm run dev    # Desarrollo con nodemon
npm start      # Producción
```

### Client
```bash
npm run dev     # Desarrollo con Vite
npm run build   # Build de producción
npm run preview # Preview del build
```

---

## 🏗️ Arquitectura de datos

```
Google Places API
       ↓  (polling 1 min)
   syncService.js
       ↓
   MongoDB
   ├── reviews         → deduplicadas por hash
   └── businesssnapshots → estado actual del negocio
       ↓
   Socket.IO
       ↓
   React Dashboard
```

---

## 📄 Licencia

MIT — InnoApp
