# Corpus de meditaciones diarias de Opus Dei

Este directorio prepara una futura función de Atlas sin copiar masivamente artículos protegidos.

Cada año se divide en doce Markdown mensuales. Cada entrada admite:

- fecha y título;
- enlace oficial;
- tres o más temas;
- referencia y enlace al Evangelio;
- fragmento descriptivo breve;
- estado de revisión editorial.

Los textos completos se leen en la fuente oficial. Para completar o corregir una entrada se edita `data/opusdei-meditation-overrides.json` y se ejecuta:

```powershell
node tools/build-opusdei-meditation-corpus.mjs 2026
```

La URL de cada día queda preparada aunque su ficha todavía figure como pendiente; nunca se presenta una entrada pendiente como contenido revisado.
