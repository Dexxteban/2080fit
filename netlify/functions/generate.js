const AIRTABLE_TABLE = 'Usuarios';

const FREE_SYSTEM = `Eres experto en longevidad. Generas datos estructurados en JSON para informes de salud de personas 40-65 años.

REGLAS ABSOLUTAS:
- Responde SOLO con JSON válido, sin texto previo ni bloques markdown
- Lenguaje cotidiano: nunca término técnico sin explicación entre paréntesis
- Analogías: coches, edificios, fábricas, cocinas — nunca laboratorios
- Personaliza con los datos exactos del usuario (edad, estrés, sueño, restricciones)
- Máximo 3 suplementos, justificación específica para este usuario
- Sin lactosa/vegano → proteína guisante, nunca whey
- Vegano → omega-3 algas, nunca pescado
- GLP-1 → siempre alerta pérdida muscular
- Estatinas → siempre mencionar CoQ10
- Metformina → mencionar interferencia con ejercicio
- Usa los valores de edad_metabolica_actual y edad_metabolica_objetivo que se te pasan — NO los recalcules`;

const PRO_SYSTEM = `Eres experto en longevidad. Generas datos estructurados en JSON para planes PRO de salud de personas 40-65 años.

REGLAS ABSOLUTAS:
- Responde SOLO con JSON válido, sin texto previo ni bloques markdown
- Lenguaje cotidiano: nunca término técnico sin explicación entre paréntesis
- Personaliza al máximo: usa edad, sexo, peso, cintura, restricciones, medicación
- Máximo 3 suplementos justificados para este usuario exacto
- Sin lactosa/vegano → proteína guisante; Vegano → omega-3 algas
- GLP-1 → alerta pérdida muscular; Estatinas → CoQ10; Metformina → ejercicio
- Usa los valores de edad_metabolica_actual y edad_metabolica_objetivo que se te pasan
- El plan PRO incluye menu_semanal y plan_entrenamiento detallados`;

async function saveToAirtable(fields) {
  const key = process.env.AIRTABLE_KEY;
  const base = process.env.AIRTABLE_BASE;
  if (!key || !base) return;
  try {
    await fetch(`https://api.airtable.com/v0/${base}/${AIRTABLE_TABLE}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
  } catch (e) {
    console.error('[Airtable] save error:', e.message);
  }
}

async function callClaude(apiKey, system, prompt, maxTokens) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Claude API ${response.status}`);
  return { text: data.content?.[0]?.text || '{}', usage: data.usage };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada en Netlify' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Body JSON inválido' })
    };
  }

  const { prompt, userData, isPro = false } = body;
  if (!prompt) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Falta el campo prompt' })
    };
  }

  const t0 = Date.now();
  const system = isPro ? PRO_SYSTEM : FREE_SYSTEM;
  const maxTokens = isPro ? 4000 : 2000;

  let text, usage;
  try {
    ({ text, usage } = await callClaude(apiKey, system, prompt, maxTokens));
  } catch (err) {
    console.error('[Claude] primer intento fallido:', err.message, '— reintentando...');
    try {
      ({ text, usage } = await callClaude(apiKey, system, prompt, maxTokens));
    } catch (err2) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err2.message })
      };
    }
  }

  // Verificar que el JSON es parseable; si no, un reintento más
  let parsed;
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    console.warn('[Claude] JSON malformado en primer intento — reintentando...');
    try {
      const retry = await callClaude(apiKey, system, prompt, maxTokens);
      text = retry.text;
      usage = retry.usage;
      const clean2 = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean2);
    } catch (parseErr) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No se pudo parsear la respuesta de Claude' })
      };
    }
  }

  const ms = Date.now() - t0;
  console.log(`[generate] perfil=${parsed.perfil || '?'} | tokens=${usage?.output_tokens || '?'} | ms=${ms} | pro=${isPro}`);

  // Guardar en Airtable (fire-and-forget)
  if (userData) {
    saveToAirtable({
      Nombre: userData.nombre || 'Anónimo',
      Email: userData.email || '',
      Perfil: parsed.perfil || '',
      Sexo: userData.sexo || '',
      Edad: parseInt(userData.edad) || 0,
      Objetivos: userData.objetivos || '',
      Restricciones: userData.restricciones || 'ninguna',
      Actividad: userData.actividad || '',
      Estres: parseInt(userData.estres) || 5,
      Sueno: userData.sueno || '',
      Medicacion: userData.medicacion || 'ninguna',
      Cintura: parseInt(userData.cintura) || 0,
      RespuestaLibre2: userData.open2 || '',
      RespuestaLibre3: userData.open3 || '',
      RespuestaLibre4: userData.open4 || '',
      RespuestaLibre5: userData.open5 || '',
      EsProUser: isPro,
      FechaHora: new Date().toISOString()
    });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: JSON.stringify(parsed) })
  };
};
