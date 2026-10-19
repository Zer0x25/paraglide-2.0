# CI duplicado entre PR, Release Please y RC

- Causa: el CI automático del PR del bot convivía con un dispatch explícito, y cada RC volvía a llamar a las mismas suites sin consultar qué contenido ya se había validado.
- Señal: seguir los jobs reales y los pasos ejecutados, no solo el nombre del workflow; el ciclo #73 → #74 pasó cuatro veces por tipos, lint y unitarios.
- Regla: una validación se reutiliza solo con evidencia de un run exitoso y contenido comprobado; metadata no equivale a cambio de código, pero dependencias, integridades y definición de CI siempre invalidan la huella. Mantener integración/E2E sobre las imágenes de staging.
