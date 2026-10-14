# Bild-Prompts für Xiao Chu

Prompts für KI-Bildgeneratoren (z. B. Midjourney, Ideogram, Flux, DALL·E, Imagen). Die Prompts
sind auf Englisch, weil die meisten Generatoren damit verlässlicher arbeiten.

## Technische Vorgaben

| | Hero (Startseite) | Kategorie-Bilder |
|---|---|---|
| Seitenverhältnis | 3:2 quer | 4:3 quer |
| Mindestgröße | 2400 × 1600 px | 1600 × 1200 px |
| Format | JPEG oder PNG; die Website wandelt in WebP um | wie Hero |
| Dateigröße | unter 15 MB (Upload-Grenze im CMS) | wie Hero |
| Motiv-Platzierung | Hauptmotiv mittig, rundum ca. 15 % Luft: Die Website schneidet auf dem Handy auf 16:10 und am Desktop fast quadratisch zu | Motiv mittig |
| Text im Bild | keiner (keine Schrift, keine Logos, keine Wasserzeichen) | keiner |

Nach dem Hochladen im CMS: Alternativtext ausfüllen, z. B. „Gongbao-Huhn mit Erdnüssen in einer
weißen Emaille-Schale“, und den Fokuspunkt auf das Gericht setzen.

## Gemeinsamer Stil (an jeden Prompt anhängen)

```
Editorial food photography for a modern, friendly neighbourhood Chinese restaurant in Berlin.
Soft natural daylight from a window, gentle shadows, true-to-life colours, appetising but honest,
shallow depth of field. Tableware: white enamel plates and bowls with a thin cobalt-blue rim,
light grey terrazzo or pale concrete table, a pale jade-green linen napkin as the only accent.
Calm, airy, uncluttered composition, plenty of negative space, slightly top-down 30–45° angle.
No red lanterns, no dragons, no gold, no calligraphy, no text, no logos, no people's faces,
no chopsticks stuck upright in rice.
```

Bei Midjourney zusätzlich: `--ar 3:2 --style raw` (Hero) bzw. `--ar 4:3 --style raw` (Kategorien).
Negativ-Prompt, falls der Generator einen hat: `text, letters, watermark, logo, red lanterns,
dragon, gold ornaments, plastic food, oversaturated, cluttered, people`.

## Hero

```
A generous shared table seen from slightly above: steaming bamboo baskets of dumplings, a bowl of
glossy kung pao chicken with peanuts, stir-fried green vegetables with garlic, a bowl of
mapo tofu with red chili oil, rice in small enamel bowls, two hands reaching in from the edge
holding chopsticks (no faces). Late-afternoon window light, warm and inviting, lively but tidy.
[Gemeinsamer Stil]
```

Variante für einen zweiten Slide:

```
Close-up of a wok over a flame in a small open kitchen, vegetables and noodles mid-toss, a
light cloud of steam, stainless steel and white tiles in the background, motion feeling but
sharp food. [Gemeinsamer Stil]
```

## Ein Bild pro Kategorie

| Kategorie | Prompt (plus gemeinsamer Stil) |
|---|---|
| Suppen | `A white enamel bowl of hot and sour soup with tofu strips, wood ear mushrooms and egg ribbons, a ceramic spoon resting on the rim, gentle steam.` |
| Kalte Vorspeisen | `Three small enamel plates side by side: smashed cucumber salad with garlic and chili oil, green beans in ginger vinegar, sliced smoked tofu with sesame oil and scallions.` |
| Warme Vorspeisen & Dim Sum | `An open bamboo steamer with translucent shrimp har gow and pleated xiaolongbao, a small dish of black vinegar with ginger strips beside it, soft steam rising.` |
| Huhn | `Kung pao chicken in a shallow enamel bowl: diced chicken, roasted peanuts, dried red chilies, scallion pieces, glossy sauce.` |
| Schwein | `Red-braised pork belly cubes, deeply glazed, in a white enamel bowl with a few blanched bok choy leaves.` |
| Ente | `Crispy duck breast sliced into strips on a white enamel plate, spring onions and a small dish of dark sauce.` |
| Rind | `Stir-fried beef with broccoli on an enamel plate, tender beef slices, bright green florets, light glossy sauce, wisps of wok steam.` |
| Fisch & Garnelen | `Salt and Sichuan pepper shrimp in their shells on an enamel plate, sliced chili and garlic, a lime wedge.` |
| Vegetarisch & vegan | `Yuxiang-style aubergine in a deep enamel bowl, silky aubergine strips in a garlic chili sauce, topped with scallions.` |
| Reis & Nudeln | `Egg fried rice and stir-fried egg noodles with vegetables in two enamel bowls, chopsticks resting on the noodle bowl.` |
| Desserts | `Golden fried sticky rice balls on a small enamel plate next to a scoop of vanilla ice cream, a light dusting of sesame.` |
| Softdrinks & Säfte | `Two tall glasses of fresh juice, mango and cherry, with condensation, on the terrazzo table in daylight. No brand bottles.` |
| Tee & Kaffee | `A clear glass teapot of jasmine tea with open flowers, two small porcelain cups, a cup of espresso in the background.` |
| Bier & Wein | `A glass of pale lager and a glass of white wine on the terrazzo table next to a small plate of edamame. No labels or brand names.` |

## Wichtig vor der Veröffentlichung

- **Kennzeichnung:** KI-Bilder von Gerichten wirken wie echte Fotos. Deshalb bei jedem Bild in der
  Bildunterschrift „Symbolbild (KI-generiert)“ angeben. Ob die Transparenzpflichten der
  EU-KI-Verordnung (Art. 50) hier greifen, vor dem Start mit aktuellen Quellen prüfen; die
  Kennzeichnung ist in jedem Fall der sichere Weg.
- **Keine Irreführung:** Die Bilder sollen dem tatsächlichen Gericht entsprechen (Portion, Zutaten,
  Anrichtung). Am besten später durch echte Fotos des Restaurants ersetzen.
- **Nutzungsrechte:** Die Lizenzbedingungen des Generators für kommerzielle Nutzung prüfen und im
  CMS-Feld „Bildnachweis / Lizenz“ festhalten.
