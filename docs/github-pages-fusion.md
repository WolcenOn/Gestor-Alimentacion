# Publicar la rama de fusión en GitHub Pages

Esta rama está preparada para funcionar como app estática en GitHub Pages sin proceso de build.

## Rama

```text
fusion-glucosatrack-planificador
```

## Configuración recomendada en GitHub

1. Entra en el repositorio `WolcenOn/Gestor-Almentacion`.
2. Abre **Settings**.
3. Entra en **Pages**.
4. En **Build and deployment**, elige:
   - Source: `Deploy from a branch`
   - Branch: `fusion-glucosatrack-planificador`
   - Folder: `/ (root)`
5. Guarda los cambios.

La app debe servirse desde la raíz del repositorio porque `index.html` carga los módulos con rutas relativas.

## Archivos relevantes para Pages

```text
index.html
styles.css
app/**/*.js
packs/**/*.json
docs/**/*.md
.nojekyll
```

## Qué incluye esta rama

- Adaptador de datos `app/state/glucosaTrackAdapter.js`.
- Bootstrap visual `app/glucosaTrackFusionBootstrap.js`.
- Marcador `.nojekyll` para evitar que GitHub Pages procese la app como Jekyll.
- Documentación de fusión en `docs/glucosatrack-fusion-plan.md`.

## Flujo de datos

```text
Planificador del Gestor
  ↓
glucosaTrackAdapter.js
  ↓
glucosaTrackFusionBootstrap.js
  ↓
Vista Metabólico / GlucosaTrack
```

## Notas de seguridad

La simulación de insulina aparece solo como orientación educativa. No debe usarse para decidir dosis, tratamientos ni cambios médicos.

## Prueba local

```bash
git checkout fusion-glucosatrack-planificador
python3 -m http.server 5173
```

Después abre:

```text
http://localhost:5173
```

Comprueba la pestaña **Metabólico**.
