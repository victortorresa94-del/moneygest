# MoneyGest — Contexto del Proyecto

## Descripción
App de gestión financiera personal: ingresos, gastos, suscripciones, ingresos esperados, categorías personalizadas y dashboard con resumen mensual. Diseño minimalista, fuente Inter/Arial, colores neutros.

## Archivos relevantes
| Archivo | Propósito |
|---|---|
| `finanzas.html` | Fuente principal — la app completa en un solo HTML |
| `index.html` | Copia de `finanzas.html` para GitHub Pages |
| `server.js` | Servidor de desarrollo local (Node.js, puerto 5500) |

## URL en producción
**https://victortorresa94-del.github.io/moneygest/**
(Requiere activar GitHub Pages en Settings → Pages → Branch: main / root)

## Cómo arrancar en local
```bash
node server.js
# Abre http://localhost:5500
```

## Bug pendiente — JS no ejecuta ⚠️
El script inline de `finanzas.html` tiene un **template literal anidado** en la función `renderSubscriptions` que rompe el parser del navegador.

**Línea afectada** (~línea 948 en `finanzas.html`):
```js
// ROTO — backtick anidado dentro de ${}
<div class="sub-meta">Día ${s.day} · ${cycleLabel[s.cycle]||s.cycle}${s.active?` · <span class="days-badge ${cls}">${dlabel}</span>`:' · Pausada'}</div>
```

**Fix** — pre-calcular la expresión antes del template principal:
```js
// Añadir ANTES del return `...`
const daysBadge = s.active
  ? ' · <span class="days-badge ' + cls + '">' + dlabel + '</span>'
  : ' · Pausada';

// Y en el template sustituir la línea rota por:
<div class="sub-meta">Día ${s.day} · ${cycleLabel[s.cycle]||s.cycle}${daysBadge}</div>
```

La función `renderSubscriptions` empieza alrededor de la línea 930 en `finanzas.html`.

**Efecto del bug:** el dashboard carga la estructura HTML estática pero el JS no se ejecuta, por lo que las tarjetas de stats y todos los listados aparecen vacíos.

## Flujo de backup recomendado
Antes de hacer cambios en la app:
1. Ve a **Datos** en el sidebar → "Descargar backup" → guarda el `.json`
2. Haz tus cambios y despliega
3. Si pierdes datos: ve a **Datos** → "Cargar backup" → selecciona el `.json`

Los datos están en `localStorage` bajo las claves `fnz_tx`, `fnz_exp`, `fnz_sub`, `fnz_cats`.
El `localStorage` persiste entre deploys en la misma URL, pero se pierde si limpias el navegador o cambias de dispositivo. El backup JSON es la solución.

## Funcionalidades implementadas
- Dashboard con stats mensuales (ingresos, gastos, balance, esperado pendiente)
- Navegación por mes (anterior / siguiente)
- Top categorías de ingreso y gasto con barra de progreso
- Próximas suscripciones activas
- Ingresos esperados pendientes
- Últimos movimientos del mes
- Página Movimientos: listar, filtrar, añadir/editar/eliminar
- Página Ingresos Esperados: añadir/editar/eliminar, marcar cobrado
- Página Suscripciones: gestión completa, activar/pausar, badge días restantes
- Página Categorías: crear/editar/eliminar categorías de ingreso y gasto
- Página Datos: exportar backup JSON / importar backup JSON (para no perder datos entre cambios)

## Stack
- Vanilla HTML/CSS/JS — sin frameworks, sin dependencias
- `localStorage` para persistencia de datos
- Todo en un único archivo HTML

## Repo
```
https://github.com/victortorresa94-del/moneygest.git
```
