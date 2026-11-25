# Trazo — Screenshot Técnico para Google Chrome

> Extensión minimalista **Manifest V3** diseñada para capturar screenshots técnicos **100% con una sola mano (solo mouse)**.  
> Una aportación open source de **Cabuya Creativa** & **Alexis Roman**.

---

## Características principales

- **Operación a una sola mano (Solo Mouse)**: Activa la herramienta con un clic en el icono de la extensión y controla todo sin tocar el teclado.
- **Modo `Elemento` (Scroll libre + Pin & Zoom)**:
  - Desplázate por cualquier página con el scroll normal del mouse o trackpad.
  - **1er clic** sobre un bloque para **fijarlo** y abrir la micro-barra flotante (`Padre` / `Capturar` / `Hijo`).
  - Usa la rueda del mouse o los botones `Padre` / `Hijo` para ajustar exactamente el contenedor que quieres capturar.
  - **2do clic** directo sobre el bloque fijado para capturar al instante.
- **Modo `Recuadro` (Área libre)**:
  - Soporta **clic y arrastrar** o **dos clics** (esquina inicial → esquina final).
- **Modo `Página` (Vista actual o Página completa)**:
  - Elige entre capturar **Solo vista actual** o **Toda la página a lo largo** (scroll automático y unión en PNG de alta resolución, ocultando cabeceras `fixed`/`sticky` para evitar duplicados).
- **Etiqueta técnica opcional (`Info: ON / OFF`)**:
  - En **ON**: Muestra en vivo el selector CSS (`tag#id.clase`) y las dimensiones en `px`, y estampa una barra técnica limpia al pie de la imagen.
  - En **OFF**: Genera capturas 100% limpias sin etiquetas.
- **Auto-Copy + Historial local (`IndexedDB`)**:
  - Cada captura se copia automáticamente al portapapeles (`image/png`) y se guarda en la memoria local del navegador (`IndexedDB`), con galería para volver a copiar, descargar en PNG o eliminar las que ya no necesites.
- **Clic derecho contextual**: Suelta el elemento fijado, cancela el recuadro en curso o cierra **Trazo** cómodamente.

---

## Cómo obtener e instalar Trazo en Google Chrome

### Opción 1: Descargar ZIP desde GitHub (más rápido)
1. En este repositorio, haz clic en el botón verde **`<> Code`** → **`Download ZIP`**.
2. Descomprime el archivo `.zip` en una carpeta fija de tu computadora (por ejemplo `Documentos/Trazo`).

### Opción 2: Clonar con Git
```bash
git clone https://github.com/AlexisRM88/trazo.git
```

### Cargar la extensión en Google Chrome
1. Abre una nueva pestaña en Google Chrome y entra a:
   ```text
   chrome://extensions
   ```
2. Activa el interruptor **Modo de desarrollador** (esquina superior derecha).
3. Haz clic en el botón **Cargar descomprimida** (*Load unpacked*).
4. Selecciona la carpeta del proyecto (`trazo`).
5. *(Opcional recomendado)* Haz clic en el icono de **rompecabezas (Extensiones)** en la barra superior de Chrome y fija **Trazo** con el pin para activarlo siempre con 1 clic.

---

## Cómo usar Trazo

1. Navega a cualquier sitio web y haz clic en el icono de **Trazo** en tu barra de Chrome.
2. Elige el modo en la barra inferior flotante:
   - **`Elemento`**: Pasa el cursor, haz clic para fijar un bloque, ajusta `Padre` / `Hijo` si lo necesitas y presiona **`Capturar`** (o haz clic de nuevo sobre el bloque).
   - **`Recuadro`**: Traza un rectángulo libre sobre cualquier zona de la pantalla.
   - **`Página`**: Elige entre **Solo vista actual** o **Toda la página a lo largo**.
3. Pega tu captura directamente (`Cmd + V` / `Ctrl + V`) en Slack, Notion, Figma, Jira o donde la necesites, o revisa tus capturas previas en **`Historial`**.

---

## Estructura del proyecto

```text
├── manifest.json   # Configuración Manifest V3
├── background.js   # Service Worker (inyección, captureVisibleTab y mensajería)
├── storage.js      # Persistencia local en IndexedDB (TechSnapDB)
├── content.js      # HUD en Shadow DOM, inspector DOM, recorte y stitch
├── content.css     # Estilos encapsulados de la interfaz
└── icons/          # Iconos PNG de la extensión (16, 32, 48, 128 px)
```

---

## Licencia y Autoría

Publicado bajo licencia **MIT** — ver [LICENSE](LICENSE).  
Desarrollado y compartido como aportación a la comunidad por **Cabuya Creativa** & **Alexis Roman**.
