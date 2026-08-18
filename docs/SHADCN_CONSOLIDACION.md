# Shadcn/ui — Consolidación de capa UI oficial

**Fecha:** Abril 2026  
**Principio rector:** _Consolidar, no cosmetizar. Arquitectura Shadcn sin romper el diseño ni las páginas críticas._

---

## Hallazgo clave del audit

> **El proyecto ya usa la arquitectura Shadcn/ui (CVA + `cn` + `forwardRef` + `VariantProps`) con un design system propio bien construido.**  
> NO usa `@radix-ui/*` (no instalado). Esto es intencional para esta fase.

Esto es correcto y pragmático: la arquitectura de Shadcn es el patrón estándar de la industria, y el design system propio (`--primary: #02c1a1`, tokens warm) define la identidad visual del ERP. Reemplazar los tokens con los de Shadcn default rompería el diseño.

---

## 1. Componentes auditados

### `src/components/ui/` — 8 archivos originales

| Archivo | Estado previo | Evaluación | Acción |
|---------|--------------|------------|--------|
| `button.tsx` | ✅ Bien | CVA + cn + VariantProps | Base oficial — sin cambios |
| `button-variants.ts` | ✅ Bien | 4 variantes: default/secondary/ghost/outline | Base oficial — sin cambios |
| `badge.tsx` | ✅ Bien | CVA + 5 variantes semánticas (neutral/info/success/warning/danger) | Base oficial — sin cambios |
| `card.tsx` | ✅ Bien | Sub-components (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter) | Base oficial — sin cambios |
| `dialog.tsx` | ✅ Bien | Custom sin Radix: Escape, backdrop-click, overflow-hidden | Base oficial — sin cambios |
| `input.tsx` | ✅ Bien | forwardRef + cn + `inputBaseClassName` exportada | Base oficial — sin cambios |
| `textarea.tsx` | ✅ Bien | forwardRef + cn + `textareaBaseClassName` exportada | Base oficial — sin cambios |
| `select.tsx` | ❌ **Roto** | `border rounded p-2` — sin design system, sin forwardRef | **Corregido** |

### `src/components/shared/` — 6 archivos

| Archivo | Tipo | Estado |
|---------|------|--------|
| `login-card.tsx` | Componente de dominio | Usa Button, Badge, Card, Input correctamente |
| `metric-card.tsx` | Componente de dominio | Usa Card + cn |
| `page-header.tsx` | Componente de layout | Wrapper de dominio |
| `brand-logo.tsx` | Componente de marca | Identidad visual |
| `auth-cta.tsx` | Componente de dominio | Sección de auth en landing |
| `app-error-boundary.tsx` | Infraestructura | Error boundary React |

---

## 2. Componentes que quedaron como base UI oficial

Todos en `src/components/ui/` son **base UI oficial** del proyecto:

```
src/components/ui/
├── button.tsx         ← Primitive oficial ✅
├── button-variants.ts ← CVA variants exportables ✅
├── badge.tsx          ← Primitive oficial ✅
├── card.tsx           ← Primitive oficial ✅
├── dialog.tsx         ← Primitive oficial ✅
├── input.tsx          ← Primitive oficial ✅
├── textarea.tsx       ← Primitive oficial ✅
├── select.tsx         ← Primitive oficial ✅ (corregido en esta fase)
├── label.tsx          ← NUEVO — primitive oficial ✅
├── checkbox.tsx       ← NUEVO — primitive oficial ✅
├── table.tsx          ← NUEVO — primitive oficial ✅
└── separator.tsx      ← NUEVO — primitive oficial ✅
```

---

## 3. Componentes corregidos en esta fase

### `select.tsx` — corregido ✅

**Antes** (inconsistente, sin pattern):
```tsx
export function Select(props) {
  return <select {...props} className={`border rounded p-2 ${props.className}`} />
}
```

**Después** (Shadcn pattern + design system):
```tsx
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-11 w-full appearance-none rounded-2xl border border-border bg-white/80 px-4 text-sm text-foreground outline-none transition',
        'cursor-pointer focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  ),
)
```

---

## 4. Componentes nuevos añadidos

### `label.tsx`
Primitive `<label>` estilizado. Necesario en formularios para consistencia semántica y visual.
```tsx
<Label htmlFor="dni">DNI del empleado</Label>
<Input id="dni" name="dni" />
```

### `checkbox.tsx`
Checkbox nativo estilizado con los tokens del design system. Útil en páginas de permisos (usuarios), configuración de alertas, etc.
```tsx
<div className="flex items-center gap-2">
  <Checkbox id="perm-ventas" name="permisos" value="ventas" />
  <Label htmlFor="perm-ventas">Ventas</Label>
</div>
```

### `table.tsx`
Primitivos de tabla para admin panels: `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`.  
Con overflow-auto, bordes del design system, hover states.

### `separator.tsx`
Divider horizontal/vertical usando tokens del design system.
```tsx
<Separator />                          // horizontal
<Separator orientation="vertical" />   // vertical
```

---

## 5. Componentes dejados como dominio

Los componentes en `src/components/shared/` son componentes de **dominio**, no primitives UI. Deben permanecer separados:

| Componente | Por qué es dominio |
|------------|-------------------|
| `LoginCard` | Contiene lógica de negocio (signIn, navigate, rol) |
| `MetricCard` | Semántica específica del ERP (label, value, icon, tone) |
| `PageHeader` | Layout específico del panel |
| `BrandLogo` | Identidad visual del producto |
| `AuthCTA` | Sección específica de onboarding |
| `AppErrorBoundary` | Infraestructura de error handling |

---

## 6. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/ui/select.tsx` | Reescrito: forwardRef + cn + design tokens |
| `src/components/ui/label.tsx` | Nuevo: forwardRef + cn |
| `src/components/ui/checkbox.tsx` | Nuevo: forwardRef + cn |
| `src/components/ui/table.tsx` | Nuevo: 7 sub-componentes |
| `src/components/ui/separator.tsx` | Nuevo: horizontal/vertical |

---

## 7. Impacto en el frontend

| Aspecto | Estado |
|---------|--------|
| Build TypeScript | ✅ Sin errores |
| Páginas críticas | ✅ Sin cambios de comportamiento |
| Design system | ✅ Intacto — mismos tokens CSS |
| `login-card.tsx` | ✅ Usa button/badge/card/input — todo correcto |
| Regresiones visuales | ✅ Cero — solo se AÑADIÓ y CORRIGIÓ `select.tsx` |
| Consistencia visual | ✅ Mejorada — `select` ahora igual que `input` |

---

## Estado de la arquitectura post-consolidación

```
ARQUITECTURA UI — Botica El Pueblo Frontend

┌──────────────────────────────────────────────────────────┐
│  DESIGN SYSTEM (src/index.css)                           │
│  --primary, --foreground, --border, --surface, etc.      │
│  Tailwind v4 @theme inline                               │
└──────────────┬───────────────────────────────────────────┘
               │ tokens CSS
┌──────────────▼───────────────────────────────────────────┐
│  PRIMITIVES UI (src/components/ui/)                      │
│  Shadcn architecture: CVA + cn + forwardRef              │
│                                                          │
│  Button · Badge · Card · Dialog · Input                  │
│  Textarea · Select · Label · Checkbox                    │
│  Table · Separator                                       │
└──────────────┬───────────────────────────────────────────┘
               │ componen composición
┌──────────────▼───────────────────────────────────────────┐
│  DOMAIN COMPONENTS (src/components/shared/)              │
│  MetricCard · LoginCard · PageHeader · BrandLogo         │
│  AuthCTA · AppErrorBoundary                              │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│  PAGES (src/pages/)                                      │
│  30+ páginas del ERP                                     │
└──────────────────────────────────────────────────────────┘
```

---

## 8. Siguiente fase recomendada: Radix UI (Fase 3)

Para llegar a **100% Shadcn/ui con Radix**, se necesitará:

### Instalar dependencias
```bash
npm install @radix-ui/react-dialog @radix-ui/react-select \
  @radix-ui/react-checkbox @radix-ui/react-tabs \
  @radix-ui/react-dropdown-menu @radix-ui/react-label \
  @radix-ui/react-separator
```

### Componentes a migrar a Radix (cuando se instalen)

| Componente actual | Migrar a | Beneficio |
|-------------------|----------|-----------|
| `dialog.tsx` (custom) | `@radix-ui/react-dialog` | Accesibilidad ARIA, focus trap, portal |
| `select.tsx` (native `<select>`) | `@radix-ui/react-select` | Dropdown estilizado completamente, keyboard nav |
| `checkbox.tsx` (native `<input>`) | `@radix-ui/react-checkbox` | Indeterminate state, ARIA |
| Ninguno hoy | `@radix-ui/react-tabs` | Tabs accesibles para panel |
| Ninguno hoy | `@radix-ui/react-dropdown-menu` | Context menus, nav dropdowns |

### Importante: mantener design tokens

Al migrar a Radix, **NO** cambiar las variables CSS a Shadcn defaults (HSL values). Los tokens del proyecto son:
```css
--primary: #02c1a1
--foreground: #16322d
--border: rgba(2, 193, 161, 0.14)
```
Mantenerlos. Solo añadir los tokens de Radix que sean necesarios.

### Validaciones recomendadas para Fase 3
- Tests visuales de regresión en Dialog, Select, Dropdown
- Verificar que componentes Radix respetan `--border`, `--primary`, `--surface`
- Probar en Safari/Firefox (accesibilidad Radix más crítica)
