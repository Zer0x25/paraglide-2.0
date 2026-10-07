# Sistema de Diseño — Paraglide

## 1. Propósito y alcance

Este documento define el estándar visual de la app web (`apps/web`, Next.js 16 + Tailwind v4 CSS-first). Aplica a **todo el código nuevo** y a las modificaciones de pantallas existentes cuando se toquen.

Fuera de alcance: apps/api, packages/shared, emails/plantillas externas.

Objetivos: consistencia entre módulos (básicos y premium), soporte claro/oscuro sin duplicar estilos, accesibilidad WCAG AA y velocidad de desarrollo mediante primitivas reutilizables.

---

## 2. Principios

1. **Consistencia**: un solo color por significado (azul=acción primaria, rojo=destructivo, verde=éxito, ámbar=advertencia). Prohibido mezclar grises (`gray`/`zinc`) o rojos alternativos (`rose`).
2. **Mobile-first**: los estilos base son para móvil; `sm:`/`md:`/`lg:` añaden complejidad hacia arriba.
3. **Accesibilidad**: contraste mínimo AA (4.5:1 en texto), touch targets ≥ 36px (ideal 44px), foco visible, cierre de modales con teclado.
4. **Tokens sobre valores crudos**: nunca hex hardcodeados en TSX; usar tokens semánticos CSS o la paleta Tailwind aprobada.

---

## 3. Theming

### Mecanismo

- Dark mode por **clase** `.dark` en `<html>`, gestionada por `ThemeProvider` custom (`apps/web/src/components/ThemeProvider.tsx`): modos `light | dark | system`, persistencia en `localStorage` + cookie `theme`.
- Variant declarado en `globals.css`:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

- Los tokens semánticos se definen con valores light en `:root` y dark en `.dark`. Los componentes consumen tokens (`bg-[var(--color-surface)]`) o utilidades Tailwind; así el dark mode funciona sin escribir variantes `dark:` en cada componente.

### Cómo añadir un token

1. Añadir la variable en `globals.css` dentro de `:root` (valor light) y de `.dark` (valor dark).
2. Nombrar por **rol**, no por color: `--color-surface-raised`, no `--color-slate-800`.
3. Documentarlo en la tabla de la sección 4.

```css
:root { --success: #16a34a; }
.dark { --success: #22c55e; }
/* y en @theme inline: */
@theme inline { --color-success: var(--success); }
```

### Cómo probar claro/oscuro

- Usar el toggle de tema (`ThemeToggle`) o cambiar `localStorage.theme` (`light`/`dark`/`system`) y recargar.
- Verificar siempre ambas variantes antes de abrir PR (ver checklist §10).

> Nota: `globals.css` contiene overrides legacy `.dark .bg-white { ... !important }`. Están **congelados**: no añadir nuevos overrides `.dark !important`; los componentes nuevos deben depender solo de tokens.

---

## 4. Tokens de diseño

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--color-surface` | slate-50 `#f8fafc` | slate-900 `#0f172a` | Fondo de página |
| `--color-surface-raised` | white `#ffffff` | slate-800 `#1e293b` | Cards, modales, paneles |
| `--color-border-default` | slate-200 `#e2e8f0` | slate-700 `#334155` | Bordes de cards, inputs, divisores |
| `--color-text-primary` | slate-900 `#0f172a` | slate-50 `#f8fafc` | Texto principal |
| `--color-text-secondary` | slate-600 `#475569` | slate-400 `#94a3b8` | Texto secundario, labels |
| `--color-text-muted` | slate-400 `#94a3b8` | slate-500 `#64748b` | Metadatos, placeholders |
| `--color-accent` | blue-600 `#2563eb` | blue-500 `#3b82f6` | Botón primario, links, foco |
| `--color-accent-hover` | blue-700 `#1d4ed8` | blue-600 `#2563eb` | Hover del primario |

> Nota de implementación: en `globals.css` las variables crudas se llaman `--surface`, `--text-primary`, etc. (sin prefijo `--color-`) y se exponen a Tailwind v4 vía un bloque `@theme inline { --color-surface: var(--surface); ... }`. Para añadir un token: define la variable cruda en `:root` y `.dark`, y añade su mapeo `--color-*` en `@theme inline`. Las utilidades generadas siguen el patrón `bg-surface`, `bg-surface-raised`, `border-default`, `text-accent`… (ojo: `--color-text-primary` genera `text-text-primary`; para texto usa preferentemente clases Tailwind estándar como `text-slate-*`).

Colores de estado (paleta Tailwind directa, sin token): rojo = destructivo (`red-600`/`red-500`), verde = éxito (`green-600`/`green-500`), ámbar = advertencia (`amber-500`). Neutra: **slate** exclusivamente.

---

## 5. Primitivas UI

Ubicación: `apps/web/src/components/ui/`. Import único:

```tsx
import { Button, Input, Modal, Badge, Spinner, Skeleton, Card } from '@/components/ui';
```

### Button

Variantes `primary | secondary | danger | ghost`; tamaños `sm | md | lg`; estado `loading`.

<Button variant="primary" size="md" loading={guardando} onClick={guardar}>
  Guardar
</Button>
<Button variant="danger" size="sm">Eliminar</Button>
```

### Input

Input estilizado + export `inputClass` para reusar el estilo en `select`/`textarea`.

```tsx
<Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" />
<textarea className={inputClass} rows={3} />
```

### Modal

Props: `open`, `onClose`, `title`, `footer`, `size` (`sm | md | lg | xl | 2xl | 4xl`, default `md`). Cierra con Escape y clic en backdrop; bloquea el scroll del body. Contenedor `max-h-[90vh]` con body scrollable.

```tsx
<Modal open={abierto} onClose={() => setAbierto(false)} title="Nuevo piloto"
       footer={<Button onClick={guardar}>Guardar</Button>}>
  <form className="space-y-4">…</form>
</Modal>
```

### Badge

Variantes `blue | green | red | amber | gray | purple`; estilos `soft` (fondo tenue) y `solid`. Siempre `rounded-full`.

```tsx
<Badge variant="green" soft>Confirmada</Badge>
<Badge variant="red">Vencida</Badge>
```

### Spinner

Tamaños `sm | md | lg`. Para botones usar `loading` de `Button`, no un Spinner suelto.

```tsx
{cargando ? <Spinner size="md" /> : <ListaVuelos />}
```

### Skeleton

Placeholder de carga para estados de loading de datos. El componente aporta `animate-pulse` y los colores `bg-slate-200 dark:bg-slate-700`; el consumidor define tamaño y redondeo vía `className` (`h-3 w-20 rounded`, `h-4 w-32 rounded-2xl`).

```tsx
{isLoading ? (
  <div className="space-y-2">
    <Skeleton className="h-4 w-32 rounded-2xl" />
    <Skeleton className="h-3 w-20 rounded" />
  </div>
) : (
  <Datos />
)}
```

Regla: los estados de carga usan `<Skeleton>`, nunca `div`s ad-hoc con `animate-pulse`.

### Card

Contenedor estándar: `rounded-2xl shadow-sm border` con fondo `surface-raised`. Export `cardClass` para aplicar el estilo a otros elementos.

```tsx
<Card className="p-4">
  <h2 className="text-lg font-semibold">Resumen</h2>
</Card>
<div className={cardClass}>Alternativa sin wrapper</div>
```

---

## 6. Patrones responsive

| Tema | Regla |
|---|---|
| Breakpoints | Estándar Tailwind `sm` (640) / `md` (768) / `lg` (1024). Mobile-first: base = móvil |
| Listas densas | Patrón dual: **cards `< md` / tabla `≥ md`**. Referencia: `apps/web/src/app/(app)/pilotos/page.tsx` |
| Tablas | SIEMPRE dentro de `overflow-x-auto` |
| Touch targets | Mínimo 36px, ideal 44px (botones de icono incluidos) |
| Modales | `max-h-[90vh]`, body scrollable, footer fijo |
| Página | Padding `p-4 md:p-8`; ancho limitado por `max-w-7xl` del AppShell |
| Header de página | Patrón `PageHeader`: título `text-2xl sm:text-3xl font-bold` + acciones a la derecha |

Ejemplo del patrón dual:

```tsx
{/* móvil */}
<div className="md:hidden space-y-3">{items.map(i => <CardItem key={i.id} item={i} />)}</div>
{/* escritorio */}
<div className="hidden md:block overflow-x-auto">
  <table className="min-w-full">{/* … */}</table>
</div>
```

---

## 7. Z-index y elevación

Escala estándar (no inventar valores intermedios):

| Capa | z-index |
|---|---|
| Header móvil sticky | `z-30` |
| Overlay drawer (backdrop) | `z-40` |
| Drawer / modales | `z-50` |
| Overlays anidados (modal sobre modal, dropdown sobre modal) | `z-[60]+` |

Sombras: `shadow-sm` para cards, `shadow-xl` para modales. Radios: `rounded-lg` botones/inputs, `rounded-2xl` cards/modales, `rounded-full` badges.

---

## 8. Tipografía y espaciado

**Tipografía** (escala aprobada):

| Uso | Clases |
|---|---|
| Título de página | `text-2xl sm:text-3xl font-bold` |
| Título de sección/card | `text-lg font-semibold` |
| Cuerpo | `text-sm` (base de la app) |
| Texto pequeño/metadata | `text-xs text-[var(--color-text-muted)]` |

**Espaciado**: múltiplos de la escala Tailwind — `1, 2, 3, 4, 6, 8` (`p-4`, `gap-2`, `space-y-6`…). Evitar valores arbitrarios salvo necesidad justificada. Separación vertical de secciones: `space-y-6`; dentro de formularios: `space-y-4`.

---

## 9. Reglas y antipatrones

| Prohibido | Por qué |
|---|---|
| Hex hardcodeados en TSX | Rompen theming; usar tokens (§4) o paleta Tailwind aprobada |
| Mezclar `gray`/`zinc`/`rose` | Fragmentan la paleta neutra/destructiva; solo slate y red. **En código nuevo**; el uso legacy existente (p. ej. badges semánticos `rose` de estado) se migra progresivamente |
| `text-slate-400` para texto pequeño sobre fondo claro | No cumple contraste WCAG AA; usar `text-muted`/`text-secondary` |
| Clases interpoladas dinámicamente (`bg-${color}-500`) | El compilador JIT de Tailwind no las detecta → estilos ausentes en producción. Usar mapas completos de clases |
| Nuevos overrides `.dark … !important` en `globals.css` | Difíciles de razonar y de sobreescribir; los componentes nuevos usan tokens |
| `findMany` sin límite / filtrado masivo en cliente | Fuera de alcance visual pero ligado al patrón dual: las listas grandes se paginan server-side (ADR 005) |
| Valores de z-index arbitrarios (`z-[999]`) | Rompen la escala de capas (§7) |

---

## 10. Checklist de revisión visual para PRs

- [ ] Sin hex hardcodeados en TSX; colores de la paleta aprobada o tokens.
- [ ] Sin clases `gray`/`zinc`/`rose` nuevas.
- [ ] Verificado en modo **claro y oscuro** (toggle de tema), sin texto ilegible.
- [ ] Contraste AA en textos pequeños (nada de `slate-400` sobre claro).
- [ ] Probado en móvil (~375px) y escritorio; listas densas usan el patrón dual cards/tabla.
- [ ] Tablas dentro de `overflow-x-auto`.
- [ ] Touch targets ≥ 36px (ideal 44px).
- [ ] Modales: `max-h-[90vh]`, cierran con Escape/backdrop, body scrollable, `shadow-xl rounded-2xl`.
- [ ] Z-index conforme a la escala (§7); nada de `z-[999]`.
- [ ] Botones/inputs/badges/cards usan las primitivas de `@/components/ui` (o `cardClass`/`inputClass`), no estilos ad-hoc.
- [ ] Sin clases interpoladas dinámicamente de Tailwind.
- [ ] Sin nuevos overrides `.dark !important` en `globals.css`.
