# Plataforma de Inteligencia Clínica · Logoterapia

Plataforma profesional para psicólogos logoterapeutas. Gestión de consultantes, agenda, notas de sesión, reportes formales y supervisión clínica con IA.

## Tecnología

- **Vite** + **React 18**
- **Lucide React** (íconos)
- **localStorage** para persistencia local
- **API de Anthropic** (Claude Sonnet 4) para el chat de Supervisión Clínica

---

## Instalación rápida (3 pasos)

### 1. Instalar dependencias

Abre una terminal en la carpeta del proyecto y corre:

```bash
npm install
```

### 2. Configurar API Key (solo si vas a usar el chat de Preparación de Sesión)

Copia el archivo `.env.example` y renómbralo a `.env`:

```bash
cp .env.example .env
```

Edita `.env` y pega tu API Key de Anthropic:

```
VITE_ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxx
```

> Obtén tu API Key en: https://console.anthropic.com/settings/keys

### 3. Iniciar el servidor de desarrollo

```bash
npm run dev
```

La plataforma se abrirá automáticamente en `http://localhost:5173`

---

## Estructura del proyecto

```
plataforma-logoterapia/
├── index.html              # HTML principal con Google Fonts
├── package.json            # Dependencias
├── vite.config.js          # Configuración de Vite
├── .env.example            # Plantilla para API Key
├── .gitignore
└── src/
    ├── main.jsx            # Punto de entrada React
    ├── App.jsx             # Componente principal completo
    └── index.css           # Estilos base globales
```

---

## Pestañas de la plataforma

1. **Calendario** — Vista diaria, semanal y mensual con citas
2. **Alta de Consultante** — Registro de pacientes con WhatsApp directo
3. **Preparación de mi Sesión** — Chat con Supervisor Clínico IA (requiere API Key)
4. **Notas de Sesión** — Bitácora rápida durante la sesión
5. **Reporte de Sesión** — Reporte formal de logoterapia (4 secciones)
6. **Archivo Clínico** — Búsqueda histórica y exportación de reportes

---

## Persistencia de datos

Toda la información se guarda en `localStorage` del navegador. Esto significa que:

- Los datos persisten entre sesiones
- Son privados al equipo donde se usa
- NO se sincronizan entre dispositivos
- Para respaldo, usa la función "Exportar" en el Archivo Clínico

> Si necesitas sincronización en la nube o multi-dispositivo, considera integrar un backend (Firebase, Supabase, etc.)

---

## Comandos disponibles

| Comando            | Acción                                       |
|--------------------|----------------------------------------------|
| `npm run dev`      | Inicia servidor de desarrollo                |
| `npm run build`    | Compila para producción (carpeta `dist/`)    |
| `npm run preview`  | Sirve la build de producción localmente      |

---

## Despliegue

Para producción, ejecuta `npm run build` y sube la carpeta `dist/` a:

- **Vercel** (recomendado): conecta el repositorio
- **Netlify**: arrastra la carpeta `dist/`
- **Hosting tradicional**: sube los archivos vía FTP

> ⚠ **Importante**: En producción, NO expongas la API Key en el frontend. Crea un backend ligero (Node/Express, Vercel Functions, etc.) que proxy las llamadas a Anthropic.

---

## Soporte

Plataforma desarrollada para uso clínico profesional en logoterapia.

**Diseño:** Estética sobria-clínica · Tipografía Cormorant Garamond + Lora
**Licencia:** Uso privado para la consultoría logoterapéutica
