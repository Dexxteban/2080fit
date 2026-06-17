# 2080.fit — Contexto del proyecto

## Qué es
Plataforma web de longevidad personalizada para personas 40-65 años.
Single-file HTML app desplegada en Netlify → 2080.fit (Namecheap).

## Stack actual
- index.html — todo en un único archivo (HTML + CSS + JS)
- Claude API (claude-sonnet-4-6) para generar informes en JSON
- Airtable para captura de leads
- Netlify para deploy
- Stripe Payment Links para cobros de 17€

## Variables de entorno pendientes de mover fuera del HTML
- API_KEY → Anthropic Claude API
- AIRTABLE_KEY → Personal Access Token
- AIRTABLE_BASE → ID base Airtable (app...)
- STRIPE_LINK → https://buy.stripe.com/...

## Lo que hace la app
1. Onboarding dark (6 pasos) → captura sexo, objetivos, situación, datos físicos
2. Llama a Claude API → devuelve JSON ~800 tokens
3. Renderiza dossier de salud con 8 secciones + CTA premium 17€
4. Guarda lead en Airtable

## Pendientes prioritarios
1. Mover API_KEY a Netlify Function para que no quede expuesta en el HTML
2. Añadir verificación Stripe webhook para entregar dossier pro tras pago
3. Imagen de stock Unsplash en cabecera del informe por sexo
4. Edad metabólica en hero del informe (ahora está enterrada al final)
5. Botón de compartir nativo (Web Share API)
6. Campo cintura en onboarding paso 6 para edad metabólica más precisa
7. localStorage para persistir datos onboarding → flujo pro sin re-rellenar
8. Supabase como DB cuando Airtable se quede corto

## Arquitectura objetivo con Claude Code
2080fit/
├── index.html              ← frontend (onboarding + dossier gratuito)
├── netlify/functions/
│   ├── generate.js         ← llama a Claude API (protege la key)
│   └── verify-stripe.js    ← verifica pago y devuelve dossier pro
├── .env                    ← variables locales (no subir a git)
├── netlify.toml            ← config de Netlify
└── CLAUDE.md               ← este archivo

## Afiliados HSN activos
creatina, magnesio, coq10, omega3, d3k2, vitb, whey,
guisante, ashwagandha, alcar, rala, urolitina, probioticos,
lisina, citrulina — URLs en el código bajo const HSN={}

## Diseño
- Onboarding: dark theme #0A0A08, Playfair Display + DM Mono + DM Sans
- Dossier: light theme #F4EFE6 (paper), mismas fuentes
- Colores: sage #3D6B45, terra #AA4D28, gold #8F6A1A, dark #181714

## Notas importantes
- El JSON que genera Claude tiene ~800 tokens (80% más barato que HTML directo)
- El dossier pro (17€) no está implementado aún — es el siguiente hito
- RGPD implementado: checkbox opt-in + modal política de privacidad + aviso legal
- Airtable guarda: nombre, email, perfil, edad, sexo, objetivos, restricciones,
  actividad, estrés, sueño, medicación, respuestas libres, fecha